import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_API_URL = Deno.env.get("GEMINI_API_URL");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Função para gerar o prompt com referências recentes
const generatePrompt = (recentReferences: string[] = []) => `
Você é um estudioso da Bíblia e especialista em curadoria de passagens devocionais diárias.

Selecione uma passagem bíblica **menos previsível**, mas ainda inspiradora, que traga conforto, fé, esperança ou sabedoria para o leitor de hoje.

⚙️ **Critérios de Seleção:**
- Escolha entre **1 a 6 versículos consecutivos**.
- Evite repetições frequentes (como Filipenses 4:6-7, João 3:16, Salmos 23, Jeremias 29:11).
- Prefira textos que comuniquem **fé prática**, **confiança**, **descanso espiritual**, **renovação da mente** ou **força em tempos difíceis**.
- Dê preferência a livros menos citados (Habacuque, Neemias, Sofonias, Tiago, 1 Pedro, Isaías, Josué, Hebreus, etc.).
- Mantenha equilíbrio entre Antigo e Novo Testamento — não concentre todas as passagens em um único livro.
- Traga variedade de estilos bíblicos: salmos, cartas, profecias, narrativas, sabedoria.

${
  recentReferences.length > 0
    ? `⚠️ **IMPORTANTE: NÃO SELECIONE** as seguintes referências que foram usadas recentemente:\n${recentReferences
        .map((ref) => `- ${ref}`)
        .join("\n")}\n`
    : ""
}

⚙️ **Formato e Estilo:**
- Tradução: **Nova Almeida Atualizada (NAA)**.
- Numere os versículos (1., 2., 3., etc.).
- Cada versículo em uma nova linha.
- Não adicione comentários, apenas o texto puro.
- Linguagem fiel e fluida.

Retorne **somente** no formato JSON abaixo (nomes dos campos em inglês, conteúdo em português):

{
  "verse_reference": "Livro Capítulo:Versículos",
  "verse_text": "Versículos numerados e separados por quebras de linha (\\n)",
  "reading_time_estimate": 2
}

🧠 **Exemplo:**
{
  "verse_reference": "Isaías 40:28-31",
  "verse_text": "1. Não sabes, não ouviste que o eterno Deus, o Senhor, o Criador dos confins da terra, não se cansa nem se fatiga?\\n2. Seu entendimento é inescrutável.\\n3. Ele dá força ao cansado e multiplica o poder ao que não tem vigor.\\n4. Os jovens se cansam e se fatigam, e os moços de exaustos caem,\\n5. mas os que esperam no Senhor renovam as suas forças; sobem com asas como águias, correm e não se cansam, caminham e não se fatigam.",
  "reading_time_estimate": 2
}
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Method not allowed.",
      }),
      {
        status: 405,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const secret = req.headers.get("x-cron-secret");
    if (!secret || secret !== CRON_SECRET) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Unauthorized: Invalid or missing cron secret.",
        }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Não registramos mais o início da execução para reduzir logs

    // Buscar as 10 últimas passagens geradas para evitar repetições
    const { data: recentPassages, error: recentError } = await supabase
      .from("passages")
      .select("verse_reference")
      .order("created_at", { ascending: false })
      .limit(10);

    // Ignoramos erros não críticos na busca de passagens recentes

    // Extrair referências recentes para incluir no prompt
    const recentReferences = recentPassages
      ? recentPassages.map((p) => p.verse_reference)
      : [];

    const today = new Date().toISOString().split("T")[0];

    const { data: existingPassage, error: checkError } = await supabase
      .from("passages")
      .select("id")
      .gte("created_at", `${today}T00:00:00Z`)
      .lte("created_at", `${today}T23:59:59Z`)
      .maybeSingle();

    if (checkError) {
      // Erro crítico: não conseguimos verificar se já existe passagem para hoje
      await supabase.from("cron_jobs_logs").insert({
        job_name: "passage-generate",
        status: "error",
        message: "Erro ao verificar existência de passagem para hoje",
        error_details: {
          error_message: checkError.message,
          error_code: checkError.code,
          error_hint: checkError.hint,
          date_check: today,
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: "Error checking existing passage",
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    if (existingPassage) {
      // Não registramos mais informações não críticas

      return new Response(
        JSON.stringify({
          success: true,
          data: { already_exists: true, passage_id: existingPassage.id },
          message: "Passage already exists for today.",
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // ======= CHAMADA À API GEMINI COM RETRY =======
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 segundos

    let aiRes = null;
    let errorText = "";
    let retryCount = 0;
    let success = false;

    // Função para esperar um tempo determinado
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    while (retryCount < MAX_RETRIES && !success) {
      try {
        // Gerar prompt dinâmico com referências recentes
        const dynamicPrompt = generatePrompt(recentReferences);

        aiRes = await fetch(GEMINI_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: dynamicPrompt }] }],
            generationConfig: { temperature: 0.7, topP: 0.8 },
          }),
        });

        if (aiRes.ok) {
          success = true;
          break;
        }

        errorText = await aiRes.text().catch(() => "No error text available");

        // Verificar se é um erro 503 (modelo sobrecarregado)
        if (aiRes.status === 503) {
          // Não registramos mais avisos de retry

          retryCount++;
          if (retryCount < MAX_RETRIES) {
            await sleep(RETRY_DELAY * retryCount); // Espera progressivamente mais tempo
            continue;
          }
        } else {
          // Se não for 503, não faz retry
          break;
        }
      } catch (fetchError) {
        // Erro de rede ou outro erro não relacionado à resposta HTTP
        // Não registramos erros de rede durante retentativas, apenas se falhar completamente

        retryCount++;
        if (retryCount < MAX_RETRIES) {
          await sleep(RETRY_DELAY * retryCount);
          continue;
        }
        break;
      }
    }

    if (!success) {
      // Erro crítico: API Gemini falhou após todas as tentativas
      await supabase.from("cron_jobs_logs").insert({
        job_name: "passage-generate",
        status: "error",
        message: "Erro na chamada à API Gemini após múltiplas tentativas",
        error_details: {
          status: aiRes?.status,
          statusText: aiRes?.statusText,
          response_text: errorText.substring(0, 1000),
          retry_attempts: retryCount,
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: "Error calling Gemini API after multiple retries",
          details:
            aiRes?.status === 503
              ? "The model is currently overloaded"
              : "API error",
        }),
        {
          status: aiRes?.status || 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleaned = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      // Erro crítico: não conseguimos processar a resposta da API
      await supabase.from("cron_jobs_logs").insert({
        job_name: "passage-generate",
        status: "error",
        message: "Erro ao processar JSON da resposta da API Gemini",
        error_details: {
          error_message: parseError?.message || "Unknown parsing error",
          raw_response: cleaned.substring(0, 1000),
          response_type: typeof cleaned,
          response_length: cleaned.length,
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to parse passage generated by AI.",
        }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const passage = {
      verse_reference: (parsed?.verse_reference || "").trim(),
      verse_text: (parsed?.verse_text || "").trim().replace(/\n/g, "<br>"),
      reading_time_estimate: parsed?.reading_time_estimate ?? 1,
    };

    if (!passage.verse_reference || !passage.verse_text) {
      // Erro crítico: resposta da API incompleta
      await supabase.from("cron_jobs_logs").insert({
        job_name: "passage-generate",
        status: "error",
        message: "Campos obrigatórios ausentes na resposta da API",
        error_details: {
          missing_fields: !passage.verse_reference
            ? "verse_reference"
            : "verse_text",
          parsed_data: JSON.stringify(parsed).substring(0, 500),
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing passage fields",
        }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const { data, error } = await supabase
      .from("passages")
      .insert({
        verse_reference: passage.verse_reference,
        verse_text: passage.verse_text,
        reading_time_estimate: passage.reading_time_estimate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Erro crítico: não conseguimos salvar no banco de dados
      await supabase.from("cron_jobs_logs").insert({
        job_name: "passage-generate",
        status: "error",
        message: "Erro ao salvar passagem no banco de dados",
        error_details: {
          error_message: error.message,
          error_code: error.code,
          error_hint: error.hint,
          passage_data: JSON.stringify(passage).substring(0, 500),
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to save passage to database.",
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Não registramos mais o sucesso para reduzir logs

    return new Response(
      JSON.stringify({
        success: true,
        data,
        message: "Daily passage generated and saved successfully.",
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error processing passage generation:", error);

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      // Mantemos apenas logs de erros críticos
      await supabase.from("cron_jobs_logs").insert({
        job_name: "passage-generate",
        status: "error",
        message: "Erro crítico na execução do job",
        error_details: {
          error_message: error?.message || "Unknown error",
          stack: error?.stack,
          error_name: error?.name,
          error_code: error?.code,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (_) {
      // ignora erros ao tentar registrar o erro
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Internal server error.",
      }),
      {
        status: error.status || 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
