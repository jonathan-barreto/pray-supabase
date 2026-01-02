import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

  try {
    if (req.method !== "GET") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Method not allowed.",
          data: null,
        }),
        {
          status: 405,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Validação de autenticação
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
          data: null,
        }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Decodificar token JWT
    let userId;
    try {
      const base64Payload = token.split(".")[1];
      if (!base64Payload) {
        throw new Error("Token malformado");
      }
      const payload = JSON.parse(
        atob(base64Payload.replace(/-/g, "+").replace(/_/g, "/"))
      );
      userId = payload.sub;
      if (!userId) {
        throw new Error("User ID não encontrado no token");
      }
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid or expired token.",
          data: null,
        }),
        {
          status: 401,
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
          data: null,
        }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Buscar último devocional privado do usuário
    const { data: privateDevotionalData, error: privateDevotionalError } =
      await supabase
        .from("private_devotionals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (privateDevotionalError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to fetch user's last private devotional.",
          data: null,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Se não houver devocional privado, retornar null
    if (!privateDevotionalData) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No private devotional found for this user.",
          data: null,
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar se o usuário curtiu o devocional
    const { data: privateLikeData } = await supabase
      .from("private_devotional_likes")
      .select("id")
      .eq("user_id", userId)
      .eq("private_devotional_id", privateDevotionalData.id)
      .maybeSingle();

    const privateDevotional = {
      ...privateDevotionalData,
      liked: !!privateLikeData,
    };

    return new Response(
      JSON.stringify({
        success: true,
        message: "Latest private devotional retrieved successfully.",
        data: privateDevotional,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in latest-private-devotional:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Internal server error.",
        data: null,
      }),
      {
        status: error.status || 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
