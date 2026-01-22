import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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

function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return errorResponse(
      "Método não permitido. Use POST para solicitar reset de senha.",
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

    const { email } = body;

    if (!email) {
      return errorResponse("Email não fornecido.", 400);
    }

    if (!isValidEmail(email)) {
      return errorResponse("Email inválido.", 400);
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

    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, name")
      .eq("email", email)
      .single();

    if (userError || !userData) {
      return successResponse(
        "Se o email estiver cadastrado, você receberá um código para redefinir sua senha.",
        null,
        200,
      );
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from("password_reset_codes")
      .insert({
        email: email,
        code: code,
        expires_at: expiresAt,
        used: false,
      });

    if (insertError) {
      console.error("❌ Erro ao salvar código:", insertError);
      return errorResponse(
        "Erro ao processar solicitação de reset de senha.",
        500,
      );
    }

    console.log("✅ Código gerado com sucesso para:", email);
    console.log("� Código:", code);

    const emailHtml = `
      <p>Olá${userData.name ? `, ${userData.name}` : ""}!</p>
      <p>Use o código abaixo para redefinir sua senha no Pray:</p>
      <p><strong style="font-size: 24px;">${code}</strong></p>
      <p><strong>Este código expira em 1 hora.</strong></p>
      <p>Se você não solicitou a recuperação de senha, ignore este email.</p>
    `;

    try {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Praify <onboarding@resend.dev>",
          to: [email],
          subject: "Recuperação de Senha - Praify",
          html: emailHtml,
        }),
      });

      const resendData = await resendResponse.json();

      if (!resendResponse.ok) {
        console.error("❌ Erro ao enviar email via Resend:", resendData);
        return errorResponse("Erro ao enviar email de recuperação.", 500);
      }

      console.log("✅ Email enviado com sucesso via Resend:", resendData.id);
    } catch (emailError) {
      console.error("❌ Erro ao enviar email:", emailError);
      return errorResponse("Erro ao enviar email de recuperação.", 500);
    }

    return successResponse(
      "Se o email estiver cadastrado, você receberá um código para redefinir sua senha.",
      null,
      200,
    );
  } catch (error) {
    console.error("❌ Erro interno:", error);
    return errorResponse(
      error.message || "Erro interno do servidor.",
      error.status || 500,
    );
  }
});
