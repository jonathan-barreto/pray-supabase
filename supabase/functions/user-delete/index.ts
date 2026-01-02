import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-token",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "DELETE") {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Método não permitido. Use DELETE para remover recursos.",
      }),
      {
        status: 405,
        headers: CORS_HEADERS,
      }
    );
  }

  try {
    const token = req.headers.get("x-user-token");
    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Token do usuário não fornecido.",
        }),
        {
          status: 401,
          headers: CORS_HEADERS,
        }
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
        {
          status: 401,
          headers: CORS_HEADERS,
        }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Corpo da requisição inválido.",
        }),
        {
          status: 400,
          headers: CORS_HEADERS,
        }
      );
    }

    if (!body.password) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Senha não fornecida para confirmação.",
        }),
        {
          status: 400,
          headers: CORS_HEADERS,
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("email")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ success: false, message: "Usuário não encontrado." }),
        {
          status: 404,
          headers: CORS_HEADERS,
        }
      );
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password: body.password,
    });

    if (signInError) {
      return new Response(
        JSON.stringify({ success: false, message: "Senha atual incorreta." }),
        {
          status: 401,
          headers: CORS_HEADERS,
        }
      );
    }

    // Deletando o usuário da autenticação - o cascade do Supabase cuidará do resto
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(
      userId
    );

    if (deleteAuthError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Erro ao excluir conta de autenticação.",
        }),
        {
          status: 500,
          headers: CORS_HEADERS,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message:
          "Conta excluída com sucesso. Todos os seus dados foram removidos.",
      }),
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (error) {
    console.error("❌ Erro ao excluir usuário:", error);
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
