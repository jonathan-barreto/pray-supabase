import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Method not allowed.",
          data: null,
        }),
        {
          status: 405,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar token de autenticação
    let token = req.headers.get("x-user-token");
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }
    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "User token not provided.",
          data: null,
        }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Extrair ID do usuário do token JWT
    let userId;
    try {
      const base64Payload = token.split(".")[1];
      if (!base64Payload) {
        throw new Error();
      }
      const payload = JSON.parse(
        atob(base64Payload.replace(/-/g, "+").replace(/_/g, "/"))
      );
      if (!payload.sub) {
        throw new Error();
      }
      userId = payload.sub;
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid or expired token.",
          data: null,
        }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Obter e validar parâmetros da requisição
    const body = await req.json().catch(() => ({}));
    const { devotional_id, feedback, evaluation_note } = body;

    // Validar devotional_id
    if (!devotional_id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "devotional_id is required.",
          data: null,
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }
    if (
      typeof devotional_id !== "number" ||
      !Number.isInteger(devotional_id) ||
      devotional_id <= 0
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "devotional_id must be a positive integer.",
          data: null,
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Validar feedback
    if (!feedback || typeof feedback !== "string" || feedback.trim() === "") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "feedback is required and must be a non-empty string.",
          data: null,
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Validar evaluation_note
    if (!evaluation_note) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "evaluation_note is required.",
          data: null,
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }
    if (
      typeof evaluation_note !== "number" ||
      !Number.isInteger(evaluation_note) ||
      evaluation_note < 1 ||
      evaluation_note > 5
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "evaluation_note must be an integer between 1 and 5.",
          data: null,
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verificar se o usuário existe
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (userError || !userData) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "User not found.",
          data: null,
        }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar se o devocional privado existe e pertence ao usuário
    const { data: devotionalData, error: devotionalError } = await supabase
      .from("private_devotionals")
      .select("id, user_id")
      .eq("id", devotional_id)
      .maybeSingle();

    if (devotionalError || !devotionalData) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Private devotional not found.",
          data: null,
        }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar se o devocional pertence ao usuário
    if (devotionalData.user_id !== userId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "You can only provide feedback for your own devotionals.",
          data: null,
        }),
        {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar se o usuário já enviou feedback para este devocional
    const { data: existingFeedback, error: checkError } = await supabase
      .from("private_devotional_feedback")
      .select("id")
      .eq("user_id", userId)
      .eq("devotional_id", devotional_id)
      .maybeSingle();

    if (checkError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to check existing feedback.",
          data: null,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    let result;
    let message;

    // Se já existe feedback, atualizar
    if (existingFeedback) {
      const { data, error: updateError } = await supabase
        .from("private_devotional_feedback")
        .update({
          feedback,
          evaluation_note,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingFeedback.id)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Failed to update feedback.",
            data: null,
          }),
          {
            status: 500,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      }

      result = data;
      message = "Feedback updated successfully.";
    } else {
      // Se não existe, criar novo feedback
      const { data, error: insertError } = await supabase
        .from("private_devotional_feedback")
        .insert({
          user_id: userId,
          devotional_id,
          feedback,
          evaluation_note,
        })
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Failed to create feedback.",
            data: null,
          }),
          {
            status: 500,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      }

      result = data;
      message = "Feedback submitted successfully.";
    }

    return new Response(
      JSON.stringify({
        success: true,
        message,
        data: result,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error in private-devotional-feedback:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error?.message || "Internal server error.",
        data: null,
      }),
      {
        status: error?.status || 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
