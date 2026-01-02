import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    const name = (body.name || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password;
    const device_token =
      typeof body.device_token === "string" && body.device_token.trim()
        ? body.device_token.trim()
        : null;

    if (!name || !email || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Nome, email e senha são obrigatórios.",
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ success: false, message: "Email inválido." }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "A senha deve ter pelo menos 8 caracteres.",
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data?.user) {
      const isConflict = error?.message?.includes("already exists");
      return new Response(
        JSON.stringify({
          success: false,
          message: isConflict
            ? "Já existe uma conta com este email."
            : "Erro ao criar usuário.",
        }),
        { status: isConflict ? 409 : 502, headers: CORS_HEADERS }
      );
    }

    const userId = data.user.id;
    const { error: userError } = await supabase
      .from("users")
      .insert({ id: userId, name, email });
    if (userError) {
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Erro ao salvar informações do usuário.",
        }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const { error: configError } = await supabase.from("user_config").insert({
      user_id: userId,
      device_token,
      notifications_enabled: true,
    });
    if (configError) {
      await supabase.from("users").delete().eq("id", userId);
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Erro ao salvar configurações do usuário.",
        }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Usuário registrado com sucesso.",
      }),
      { status: 201, headers: CORS_HEADERS }
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
