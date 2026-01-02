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
      JSON.stringify({
        success: false,
        message: "Método não permitido. Use PUT para atualizar recursos.",
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

    if (!body.email) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Novo email não fornecido.",
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
          message: "Senha atual não fornecida.",
        }),
        {
          status: 400,
          headers: CORS_HEADERS,
        }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Formato de email inválido.",
        }),
        {
          status: 400,
          headers: CORS_HEADERS,
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("email", body.email)
      .neq("id", userId)
      .maybeSingle();

    if (checkError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Erro ao verificar disponibilidade do email.",
        }),
        {
          status: 500,
          headers: CORS_HEADERS,
        }
      );
    }

    if (existingUser) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Este email já está sendo usado por outra conta.",
        }),
        {
          status: 400,
          headers: CORS_HEADERS,
        }
      );
    }

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

    const { error: authError } = await supabase.auth.admin.updateUserById(
      userId,
      { email: body.email }
    );
    if (authError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Erro ao atualizar o email na autenticação.",
        }),
        {
          status: 500,
          headers: CORS_HEADERS,
        }
      );
    }

    const { data, error } = await supabase
      .from("users")
      .update({ email: body.email, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id, name, email, created_at, updated_at")
      .single();

    if (error) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Erro ao atualizar o email do usuário.",
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
          "Email atualizado com sucesso. Por favor, verifique seu novo email.",
        data,
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
