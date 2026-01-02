import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, message: "Método não permitido." }),
      { status: 405, headers: CORS_HEADERS }
    );
  }

  try {
    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const device_token =
      typeof body.device_token === "string" && body.device_token.trim()
        ? body.device_token.trim()
        : null;

    if (!email || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Email e senha são obrigatórios.",
        }),
        { status: 422, headers: CORS_HEADERS }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.session) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Credenciais inválidas. Verifique email e senha.",
        }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const userId = data.user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Não foi possível identificar o usuário.",
        }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    if (device_token) {
      await supabase
        .from("user_config")
        .upsert({ user_id: userId, device_token }, { onConflict: ["user_id"] });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        },
        message: "Login realizado com sucesso.",
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        message: error?.message || "Erro interno do servidor.",
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
