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

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ success: false, message }, status);
}

function successResponse(message, data = null, status = 200) {
  const payload = { success: true, message };
  if (data) {
    payload.data = data;
  }
  return jsonResponse(payload, status);
}

function isStrongPassword(password) {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return regex.test(password);
}

function extractToken(req) {
  const token = req.headers.get("x-user-token");
  if (!token) {
    throw { status: 401, message: "Token do usuário não fornecido." };
  }
  return token;
}

function decodeJwt(token) {
  try {
    const base64 = token.split(".")[1];
    const payload = JSON.parse(
      atob(base64.replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (!payload?.sub) {
      throw new Error();
    }
    return payload.sub;
  } catch {
    throw { status: 401, message: "Token inválido ou expirado." };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "PUT") {
    return errorResponse(
      "Método não permitido. Use PUT para atualizar recursos.",
      405
    );
  }

  try {
    const token = extractToken(req);
    const userId = decodeJwt(token);

    let body;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Corpo da requisição inválido.", 400);
    }

    const { current_password, new_password } = body;

    if (!current_password) {
      return errorResponse("Senha atual não fornecida.", 400);
    }

    if (!new_password) {
      return errorResponse("Nova senha não fornecida.", 400);
    }

    if (!isStrongPassword(new_password)) {
      return errorResponse(
        "A nova senha deve ter pelo menos 8 caracteres, incluindo uma letra maiúscula, uma minúscula e um número.",
        400
      );
    }

    if (current_password === new_password) {
      return errorResponse(
        "A nova senha deve ser diferente da senha atual.",
        400
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("email")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      return errorResponse("Usuário não encontrado.", 404);
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password: current_password,
    });

    if (signInError) {
      return errorResponse("Senha atual incorreta.", 401);
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        password: new_password,
      }
    );

    if (updateError) {
      console.error("❌ Erro ao atualizar senha:", updateError);
      return errorResponse("Erro ao atualizar a senha.", 500);
    }

    await supabase
      .from("users")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", userId);

    return successResponse("Senha atualizada com sucesso.", null, 200);
  } catch (error) {
    return errorResponse(
      error.message || "Erro interno do servidor.",
      error.status || 500
    );
  }
});
