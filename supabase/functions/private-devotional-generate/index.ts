import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_API_URL = Deno.env.get("GEMINI_API_URL");
const CHUNK_SIZE = 5;

Deno.serve(async (req) => {
  // Verificar se a requisição vem do cron job
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== "praify-cron-secret-2025") {
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

    const { data: pendingDevotionals, error: fetchError } = await supabase
      .from("private_devotionals")
      .select("id, feeling")
      .is("title", null)
      .not("feeling", "is", null)
      .eq("processing", false)
      .limit(10);

    if (fetchError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to fetch pending devotionals.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!pendingDevotionals || pendingDevotionals.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: { processed: 0 },
          message: "No pending devotionals to process.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const devotionalIds = pendingDevotionals.map((item) => item.id);

    const { error: updateError } = await supabase
      .from("private_devotionals")
      .update({ processing: true })
      .in("id", devotionalIds);

    if (updateError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to mark devotionals as processing.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const today = new Date();
    const todayStr = today.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    let processedCount = 0;

    for (let i = 0; i < pendingDevotionals.length; i += CHUNK_SIZE) {
      const chunk = pendingDevotionals.slice(i, i + CHUNK_SIZE);
      const promises = chunk.map(async (devotional) => {
        try {
          const DEVOTIONAL_PROMPT = `
          Você é um teólogo e escritor cristão especializado em meditações expositivas e devocionais bíblicas.
          Seu papel não é falar em nome de Deus nem oferecer novas revelações, mas ajudar o leitor a refletir sobre as Escrituras e a orar a partir delas.

          Produza um devocional ORIGINAL que utilize a Bíblia como fundamento principal, considerando o sentimento informado como contexto humano e emocional, e não como autoridade interpretativa.

          Sentimento do leitor: "${devotional.feeling}"

          Diretrizes teológicas:
          - Afirme implicitamente que o texto é uma leitura possível da Escritura, não uma interpretação absoluta.
          - Evite qualquer linguagem que sugira profecia, revelação direta ou promessa específica de ação divina.
          - Conduza o leitor à reflexão, à oração e à escuta pessoal de Deus, sem substituir essa experiência.

          Estilo e linguagem:
          - Evite vocativos como "querido irmão", "querida irmã" ou referências ao dia atual.
          - Escreva com tom reflexivo, maduro e expositivo, como quem comenta um texto bíblico com sensibilidade pastoral.
          - Traga perspectivas menos óbvias, utilizando personagens ou episódios bíblicos pouco explorados (como Ana, Neemias, Habacuque, Marta, Elias, Jeremias, Gideão, etc.).
          - Explore contrastes espirituais (fé vs. medo, confiança vs. controle, esperança vs. evidência).
          - Utilize metáforas sutis e linguagem literária equilibrada, sem exageros poéticos.
          - Evite clichês cristãos e frases prontas.
          - Escreva entre 350 e 500 palavras no total.

          Sobre a oração:
          - A oração deve ser breve e servir como um ponto de partida, não como uma oração definitiva.
          - Utilize linguagem aberta, que convide o leitor a continuar orando com suas próprias palavras.

          Formato JSON final:
          {
            "title": "Título breve e instigante",
            "description": "Resumo curto e objetivo do tema tratado",
            "verse_reference": "Livro Capítulo:Versículos",
            "verse_text": "Texto bíblico em português (Nova Almeida Atualizada)",
            "reflection": "Texto expositivo e reflexivo que explora o texto bíblico à luz do tema emocional, com humildade interpretativa e referências bíblicas contextuais",
            "application": "Continuação natural da reflexão, aplicando o texto à vida espiritual de forma prática e sensível, sem listas ou marcações",
            "prayer": "Oração breve e aberta, coerente com o tema, que convide o leitor a seguir em oração pessoal",
            "reading_time_estimate": 5
          }
          `;

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
            // Registrar erro na tabela cron_jobs_logs
            await supabase.from("cron_jobs_logs").insert({
              job_name: "private-devotional-generate",
              status: "error",
              message: `Falha ao chamar Gemini API para o devocional ID ${devotional.id}`,
              error_details: {
                status: aiResponse.status,
                statusText: aiResponse.statusText,
                devotional_id: devotional.id,
                feeling: devotional.feeling,
              },
            });

            await supabase
              .from("private_devotionals")
              .update({ processing: false })
              .eq("id", devotional.id);
            return { success: false };
          }

          const aiJson = await aiResponse.json();

          // Verificar se a resposta tem a estrutura esperada
          if (!aiJson?.candidates?.[0]?.content?.parts?.[0]?.text) {
            // Registrar erro na tabela cron_jobs_logs
            await supabase.from("cron_jobs_logs").insert({
              job_name: "private-devotional-generate",
              status: "error",
              message: `Resposta inválida da Gemini API para o devocional ID ${devotional.id}`,
              error_details: {
                devotional_id: devotional.id,
                feeling: devotional.feeling,
                raw_response: JSON.stringify(aiJson).substring(0, 1000), // Primeiros 1000 caracteres da resposta bruta
              },
            });

            await supabase
              .from("private_devotionals")
              .update({ processing: false })
              .eq("id", devotional.id);
            return { success: false };
          }

          const rawText = aiJson.candidates[0].content.parts[0].text || "";

          // Tentar extrair JSON da resposta
          let cleaned = rawText.trim();

          // Remover marcadores de código markdown se existirem
          cleaned = cleaned.replace(/```json|```/g, "").trim();

          // Verificar se a resposta parece ser um JSON válido
          if (!cleaned.startsWith("{") || !cleaned.endsWith("}")) {
            // Tentar encontrar um JSON válido na resposta
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              cleaned = jsonMatch[0];
            } else {
              // Registrar erro na tabela cron_jobs_logs
              await supabase.from("cron_jobs_logs").insert({
                job_name: "private-devotional-generate",
                status: "error",
                message: `Resposta não contém JSON válido para o devocional ID ${devotional.id}`,
                error_details: {
                  devotional_id: devotional.id,
                  feeling: devotional.feeling,
                  raw_response: rawText.substring(0, 1000), // Primeiros 1000 caracteres da resposta bruta
                },
              });

              await supabase
                .from("private_devotionals")
                .update({ processing: false })
                .eq("id", devotional.id);
              return { success: false };
            }
          }

          let parsedDevotional;
          try {
            const parsed = JSON.parse(cleaned);

            // Função auxiliar para garantir que o valor seja uma string antes de chamar trim()
            const safeString = (value) => {
              if (typeof value === "string") return value.trim();
              if (value === null || value === undefined) return "";
              return String(value).trim(); // Converte para string se for outro tipo
            };

            // Função auxiliar para processar texto com quebras de linha
            const processText = (value) => {
              if (typeof value === "string")
                return value.replace(/\n/g, "<br>").trim();
              if (value === null || value === undefined) return "";
              return String(value).replace(/\n/g, "<br>").trim();
            };

            parsedDevotional = {
              title: safeString(parsed?.title),
              description: safeString(parsed?.description),
              verse_reference: safeString(parsed?.verse_reference),
              verse_text: processText(parsed?.verse_text),
              reflection: safeString(parsed?.reflection),
              application: safeString(parsed?.application),
              prayer: safeString(parsed?.prayer),
              reading_time_estimate: parsed?.reading_time_estimate ?? 5,
            };

            if (
              !parsedDevotional.title ||
              !parsedDevotional.description ||
              !parsedDevotional.verse_reference ||
              !parsedDevotional.verse_text
            ) {
              await supabase
                .from("private_devotionals")
                .update({ processing: false })
                .eq("id", devotional.id);
              return { success: false };
            }
          } catch (error) {
            // Registrar erro na tabela cron_jobs_logs com o conteúdo bruto para depuração
            await supabase.from("cron_jobs_logs").insert({
              job_name: "private-devotional-generate",
              status: "error",
              message: `Erro ao processar JSON da resposta da Gemini API para o devocional ID ${devotional.id}`,
              error_details: {
                error_message: error?.message || "Unknown parsing error",
                devotional_id: devotional.id,
                feeling: devotional.feeling,
                raw_response: cleaned.substring(0, 1000), // Primeiros 1000 caracteres da resposta bruta
                response_type: typeof cleaned,
                response_length: cleaned.length,
              },
            });

            await supabase
              .from("private_devotionals")
              .update({ processing: false })
              .eq("id", devotional.id);
            return { success: false };
          }

          const { error: updateError } = await supabase
            .from("private_devotionals")
            .update({
              title: parsedDevotional.title,
              description: parsedDevotional.description,
              verse_reference: parsedDevotional.verse_reference,
              verse_text: parsedDevotional.verse_text,
              reflection: parsedDevotional.reflection,
              application: parsedDevotional.application,
              prayer: parsedDevotional.prayer,
              reading_time_estimate: parsedDevotional.reading_time_estimate,
              processing: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", devotional.id);

          if (updateError) {
            // Registrar erro na tabela cron_jobs_logs
            await supabase.from("cron_jobs_logs").insert({
              job_name: "private-devotional-generate",
              status: "error",
              message: `Erro ao atualizar o devocional ID ${devotional.id} no banco de dados`,
              error_details: {
                error_message: updateError?.message || "Unknown database error",
                devotional_id: devotional.id,
                feeling: devotional.feeling,
              },
            });

            await supabase
              .from("private_devotionals")
              .update({ processing: false })
              .eq("id", devotional.id);
            return { success: false };
          }

          return { success: true };
        } catch (error) {
          // Registrar erro na tabela cron_jobs_logs
          await supabase.from("cron_jobs_logs").insert({
            job_name: "private-devotional-generate",
            status: "error",
            message: `Erro geral ao processar o devocional ID ${devotional.id}`,
            error_details: {
              error_message: error?.message || "Unknown error",
              devotional_id: devotional.id,
              feeling: devotional.feeling,
            },
          });

          await supabase
            .from("private_devotionals")
            .update({ processing: false })
            .eq("id", devotional.id);
          return { success: false };
        }
      });

      const results = await Promise.allSettled(promises);
      processedCount += results.filter(
        (result) => result.status === "fulfilled" && result.value.success
      ).length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { processed: processedCount },
        message: `Processed ${processedCount} devotionals successfully.`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error processing devotionals:", error);

    // Registrar erro geral na tabela cron_jobs_logs
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from("cron_jobs_logs").insert({
        job_name: "private-devotional-generate",
        status: "error",
        message: "Erro geral na execução do job",
        error_details: {
          error_message: error?.message || "Unknown error",
          stack: error?.stack,
        },
      });
    } catch (logError) {
      console.error("❌ Error logging to cron_jobs_logs:", logError);
    }

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
