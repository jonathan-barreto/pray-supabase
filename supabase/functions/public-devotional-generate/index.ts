import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_API_URL = Deno.env.get("GEMINI_API_URL");
const CRON_SECRET = "praify-cron-secret-2025";

const THEMES = [
  "fé em tempos difíceis",
  "esperança nas promessas de Deus",
  "o poder do perdão",
  "a graça que transforma",
  "propósito e confiança em Deus",
  "a presença de Deus na dor",
  "gratidão nas pequenas coisas",
  "descanso na vontade divina",
  "coragem diante do medo",
  "identidade em Cristo",
];

Deno.serve(async (req) => {
  // Verificar se a requisição vem do cron job
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== CRON_SECRET) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Unauthorized access.",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Não registramos mais o início da execução para reduzir logs

    const today = new Date();
    const todayStr = today.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Verificar se já existe um devocional para hoje
    const todayISO = today.toISOString().split("T")[0];
    const { data: existingDevotional, error: checkError } = await supabase
      .from("public_devotionals")
      .select("id")
      .gte("created_at", `${todayISO}T00:00:00Z`)
      .lte("created_at", `${todayISO}T23:59:59Z`)
      .not("title", "is", null)
      .maybeSingle();

    if (checkError) {
      await supabase.from("cron_jobs_logs").insert({
        job_name: "public-devotional-generate",
        status: "error",
        message: "Erro ao verificar existência de devocional para hoje",
        error_details: {
          error_message: checkError.message,
          error_code: checkError.code,
          error_hint: checkError.hint,
          date_check: todayISO,
        },
      });
      throw new Error(
        `Error checking existing devotional: ${checkError.message}`
      );
    }

    if (existingDevotional) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Devotional already exists for today.",
          data: { already_exists: true, devotional_id: existingDevotional.id },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Buscar os 10 últimos devocionais gerados para evitar repetições
    const { data: recentDevotionals, error: recentError } = await supabase
      .from("public_devotionals")
      .select("verse_reference")
      .order("created_at", { ascending: false })
      .limit(10);

    // Extrair referências recentes para incluir no prompt
    const recentReferences = recentDevotionals
      ? recentDevotionals.map((d) => d.verse_reference)
      : [];

    // Gerar o devocional diário
    const randomTheme = THEMES[Math.floor(Math.random() * THEMES.length)];

    // Função para gerar o prompt com referências recentes
    const generateDevotionalPrompt = (theme: string, recentRefs: string[]) => `
    Você é um teólogo e escritor cristão especializado em meditações expositivas e devocionais.
    Seu objetivo é produzir um devocional com profundidade bíblica e linguagem clara, que explore um tema espiritual a partir das Escrituras, de modo equilibrado entre razão e fé.

    Gere um devocional ORIGINAL baseado no tema: "${theme}".

    Estilo:
    - Evite vocativos como "querido irmão", "querida irmã" ou menções ao dia atual.
    - Escreva com tom reflexivo, maduro e expositivo, como quem comenta um texto bíblico de forma acessível.
    - Traga perspectivas menos óbvias, com referências a personagens ou episódios bíblicos pouco usados (como Ana, Neemias, Habacuque, Marta, Elias, Jeremias, Gideão, etc.), conectando-os ao tema espiritual proposto.
    - Inclua contrastes espirituais (por exemplo: fé vs. medo, graça vs. merecimento, obediência vs. controle).
    - Utilize metáforas sutis e linguagem literária equilibrada (nem poética demais, nem fria).
    - Evite clichês e frases prontas ("Deus está no controle", "Tudo coopera para o bem", etc.).
    - Mantenha o texto centrado em Cristo, com coerência teológica e aplicação prática.
    - Use entre 350 e 500 palavras.

    ${
      recentRefs.length > 0
        ? `⚠️ **IMPORTANTE: NÃO SELECIONE** as seguintes referências bíblicas que foram usadas recentemente:\n${recentRefs
            .map((ref) => `- ${ref}`)
            .join("\n")}\n`
        : ""
    }

    Formato JSON final:
    {
      "title": "Título breve e instigante",
      "description": "Resumo curto e objetivo do tema tratado",
      "verse_reference": "Livro Capítulo:Versículos",
      "verse_text": "Texto bíblico em português (Nova Almeida Atualizada)",
      "reflection": "Texto expositivo e reflexivo sobre o tema e o texto bíblico, com aplicação contextual e exemplos bíblicos variados",
      "application": "Texto com aplicações práticas e espirituais em formato de parágrafos corridos, sem listas ou marcações HTML. Escreva de forma natural e fluida, como uma continuação da reflexão, trazendo 3-4 aplicações práticas integradas ao texto.",
      "prayer": "Oração breve, coerente com o tema e tom do devocional",
      "reading_time_estimate": 5
    }
    `;

    // Gerar o prompt dinâmico com as referências recentes
    const DEVOTIONAL_PROMPT = generateDevotionalPrompt(
      randomTheme,
      recentReferences
    );

    const aiPayload = {
      contents: [{ parts: [{ text: DEVOTIONAL_PROMPT }] }],
      generationConfig: { temperature: 0.9, topP: 0.9 },
    };

    const aiResponse = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(aiPayload),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse
        .text()
        .catch(() => "No error text available");
      // Erro crítico: API Gemini falhou
      await supabase.from("cron_jobs_logs").insert({
        job_name: "public-devotional-generate",
        status: "error",
        message: `Erro na chamada à API Gemini`,
        error_details: {
          status: aiResponse.status,
          statusText: aiResponse.statusText,
          theme: randomTheme,
          response_text: errorText.substring(0, 1000),
        },
      });
      throw new Error(`Gemini API returned status ${aiResponse.status}`);
    }

    const aiJson = await aiResponse.json();
    let rawText = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    rawText = rawText.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    if (!parsed?.title || !parsed?.verse_reference) {
      // Erro crítico: resposta incompleta da API
      await supabase.from("cron_jobs_logs").insert({
        job_name: "public-devotional-generate",
        status: "error",
        message: `Resposta incompleta da API Gemini`,
        error_details: {
          theme: randomTheme,
          missing_fields: !parsed?.title ? "title" : "verse_reference",
          raw_response: rawText.substring(0, 1000),
          parsed_data: parsed
            ? JSON.stringify(parsed).substring(0, 500)
            : "null",
        },
      });
      throw new Error("Incomplete AI response.");
    }

    // Não registramos mais respostas de debug para reduzir logs

    // Criar o devocional com os dados recebidos do Gemini
    // Garantir que todos os campos sejam strings
    const devotional = {
      title: String(parsed.title || "").trim(),
      description: String(parsed.description || "").trim(),
      verse_reference: String(parsed.verse_reference || "").trim(),
      verse_text: String(parsed.verse_text || "")
        .replace(/\n/g, "<br>")
        .trim(),
      reflection: String(parsed.reflection || "").trim(),
      application: String(parsed.application || "").trim(),
      prayer: String(parsed.prayer || "").trim(),
      reading_time_estimate: Number(parsed.reading_time_estimate || 5),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Inserir o devocional no banco de dados
    const { data: newDevotional, error: insertError } = await supabase
      .from("public_devotionals")
      .insert(devotional)
      .select()
      .single();

    if (insertError) {
      await supabase.from("cron_jobs_logs").insert({
        job_name: "public-devotional-generate",
        status: "error",
        message: `Erro ao inserir devocional com conteúdo gerado`,
        error_details: {
          error_message: insertError.message,
          error_code: insertError.code,
          error_hint: insertError.hint,
        },
      });
      throw new Error(insertError.message);
    }

    // Não registramos mais o sucesso para reduzir logs

    return new Response(
      JSON.stringify({
        success: true,
        message: "Daily public devotional generated successfully.",
        data: { devotional_id: newDevotional.id },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      // Mantemos apenas logs de erros críticos
      await supabase.from("cron_jobs_logs").insert({
        job_name: "public-devotional-generate",
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
    } catch (_) {}

    return new Response(
      JSON.stringify({
        success: false,
        message: error?.message || "Internal server error.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
