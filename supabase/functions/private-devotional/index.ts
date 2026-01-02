import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ITEMS_PER_PAGE = 20;
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

  try {
    // Verificar token de autenticação
    let token = req.headers.get("x-user-token");
    if (!token) {
      const auth = req.headers.get("authorization");
      if (auth && auth.startsWith("Bearer ")) {
        token = auth.substring(7);
      }
    }
    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Token não fornecido",
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
      const payload = JSON.parse(
        atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
      );
      userId = payload.sub;
      if (!userId) {
        throw new Error();
      }
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

    // Obter ID do devocional da URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const devotionalId = pathParts[pathParts.length - 1];

    if (!devotionalId || isNaN(parseInt(devotionalId))) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Devotional ID is required and must be a number.",
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Inicializar cliente Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar o devocional específico pelo ID
    const { data: devotional, error: devotionalError } = await supabase
      .from("private_devotionals")
      .select("*")
      .eq("id", devotionalId)
      .eq("user_id", userId)
      .single();

    if (devotionalError) {
      if (devotionalError.code === "PGRST116") {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Devotional not found.",
          }),
          {
            status: 404,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: "Error fetching devotional.",
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    if (!devotional) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Devotional not found.",
        }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar se o usuário curtiu este devocional
    const { data: likeData } = await supabase
      .from("devotional_likes")
      .select("id")
      .eq("user_id", userId)
      .eq("private_devotional_id", devotional.id)
      .is("public_devotional_id", null)
      .maybeSingle();

    // Adicionar flag de curtido ao devocional
    devotional.liked = !!likeData;

    return new Response(
      JSON.stringify({
        success: true,
        data: devotional,
        message: "Devotional retrieved successfully.",
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error in private-devotional (get by ID):", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Internal server error.",
      }),
      {
        status: error.status || 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
