import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-token",
  "Access-Control-Allow-Methods": "PUT, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "PUT") {
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
        JSON.stringify({ success: false, message: "Token inválido." }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: "Corpo inválido." }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const name = body.name?.trim();
    if (!name || name.length < 2) {
      return new Response(
        JSON.stringify({ success: false, message: "Nome inválido." }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from("users")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id, name, email, created_at, updated_at")
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ success: false, message: "Erro ao atualizar nome." }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Nome atualizado com sucesso.",
        data,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        message: error?.message || "Erro interno.",
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
