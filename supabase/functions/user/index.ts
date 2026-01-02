import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-token",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ success: false, message: "Método não permitido." }),
      { status: 405, headers: CORS_HEADERS }
    );
  }

  try {
    const token = req.headers.get("x-user-token");
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, message: "Token não fornecido." }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    let userId;
    try {
      const base64Payload = token.split(".")[1];
      const payload = JSON.parse(
        atob(base64Payload.replace(/-/g, "+").replace(/_/g, "/"))
      );
      userId = payload.sub;
      if (!userId) {
        throw new Error();
      }
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Token inválido ou expirado.",
        }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, name, email, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "Usuário não encontrado." }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const { data: configData } = await supabase
      .from("user_config")
      .select("device_token, notifications_enabled, theme_preference, language")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: metrics } = await supabase
      .from("user_metrics")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const profile = { ...user, configData, metrics };

    return new Response(
      JSON.stringify({
        success: true,
        data: profile,
        message: "Perfil carregado com sucesso.",
      }),
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        message: error?.message || "Erro interno do servidor.",
      }),
      {
        status: error?.status || 500,
        headers: CORS_HEADERS,
      }
    );
  }
});
