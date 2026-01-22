import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return errorResponse(
      "Método não permitido. Use POST para confirmar reset de senha.",
      405,
    );
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Corpo da requisição inválido.", 400);
    }

    const { email, code, new_password } = body;

    if (!email) {
      return errorResponse("Email não fornecido.", 400);
    }

    if (!code) {
      return errorResponse("Código não fornecido.", 400);
    }

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      return errorResponse("Código inválido. Deve conter 6 dígitos.", 400);
    }

    if (!new_password) {
      return errorResponse("Nova senha não fornecida.", 400);
    }

    if (!isStrongPassword(new_password)) {
      return errorResponse(
        "A nova senha deve ter pelo menos 8 caracteres, incluindo uma letra maiúscula, uma minúscula e um número.",
        400,
      );
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const { data: resetCode, error: codeError } = await supabaseAdmin
      .from("password_reset_codes")
      .select("*")
      .eq("email", email)
      .eq("code", code)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (codeError || !resetCode) {
      console.error("❌ Código inválido ou expirado:", codeError);
      return errorResponse("Código inválido ou expirado.", 401);
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (userError || !userData) {
      console.error("❌ Usuário não encontrado:", userError);
      return errorResponse("Usuário não encontrado.", 404);
    }

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userData.id, {
        password: new_password,
      });

    if (updateError) {
      console.error("❌ Erro ao atualizar senha:", updateError);
      return errorResponse("Erro ao atualizar a senha.", 500);
    }

    const { error: markUsedError } = await supabaseAdmin
      .from("password_reset_codes")
      .update({ used: true })
      .eq("id", resetCode.id);

    if (markUsedError) {
      console.error("❌ Erro ao marcar código como usado:", markUsedError);
    }

    await supabaseAdmin
      .from("users")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", userData.id);

    console.log("✅ Senha atualizada com sucesso para:", email);

    return successResponse("Senha redefinida com sucesso.", null, 200);
  } catch (error) {
    console.error("❌ Erro interno:", error);
    return errorResponse(
      error.message || "Erro interno do servidor.",
      error.status || 500,
    );
  }
});
