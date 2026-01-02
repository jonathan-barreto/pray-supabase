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
        }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Obter o sentimento do usuário do corpo da requisição
    const body = await req.json().catch(() => ({}));
    const feeling = body.feeling;
    if (!feeling || typeof feeling !== "string" || feeling.trim() === "") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Feeling is required and must be a non-empty string.",
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
        }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar quantos devocionais privados o usuário criou nesta semana
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Domingo
    startOfWeek.setHours(0, 0, 0, 0);

    const { data: weeklyDevotionals, error: countError } = await supabase
      .from("private_devotionals")
      .select("id", { count: "exact", head: false })
      .eq("user_id", userId)
      .gte("created_at", startOfWeek.toISOString());

    if (countError) {
      console.error("Error counting weekly devotionals:", countError);
    }

    const weeklyCount = weeklyDevotionals?.length || 0;

    // Limite de 3 devocionais privados por semana
    if (weeklyCount >= 3) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "Weekly limit reached. You can create up to 3 private devotionals per week.",
        }),
        {
          status: 429, // Too Many Requests
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Salvar apenas o sentimento na tabela private_devotionals
    const { data: saved, error: saveError } = await supabase
      .from("private_devotionals")
      .insert({
        user_id: userId,
        feeling: feeling,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (saveError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to save feeling.",
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: saved,
        message: "Feeling saved successfully.",
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error saving feeling:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error?.message || "Internal server error.",
      }),
      {
        status: error?.status || 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
