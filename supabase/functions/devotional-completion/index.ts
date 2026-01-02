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
          data: null,
        }),
        {
          status: 405,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

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

    const body = await req.json().catch(() => ({}));
    const errors = [];

    if (!body.devotional_id) {
      errors.push("devotional_id is required");
    } else if (
      typeof body.devotional_id !== "number" ||
      !Number.isInteger(body.devotional_id) ||
      body.devotional_id <= 0
    ) {
      errors.push("devotional_id must be a positive integer");
    }

    if (!body.type) {
      errors.push("type is required");
    } else if (body.type !== "public" && body.type !== "private") {
      errors.push("type must be either 'public' or 'private'");
    }

    if (body.completed_at) {
      const completedAtDate = new Date(body.completed_at);
      if (isNaN(completedAtDate.getTime())) {
        errors.push("completed_at must be a valid ISO date string");
      }
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Validation failed: ${errors.join(", ")}`,
          data: null,
        }),
        {
          status: 422,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const devotional_id = body.devotional_id;
    const type = body.type;

    // Se completed_at não for fornecido, usar a hora atual no fuso horário do Brasil (UTC-3)
    let completed_at;
    if (body.completed_at) {
      completed_at = body.completed_at;
    } else {
      // Obter a data/hora atual em UTC
      const now = new Date();

      // Ajustar para o fuso horário do Brasil (UTC-3)
      const brazilOffset = -3 * 60; // -3 horas em minutos
      const brazilTime = new Date(now.getTime() + brazilOffset * 60 * 1000);

      completed_at = brazilTime.toISOString();
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    const tableName =
      type === "public" ? "public_devotionals" : "private_devotionals";
    const { data: devotionalData, error: devotionalError } = await supabase
      .from(tableName)
      .select("id")
      .eq("id", devotional_id)
      .maybeSingle();

    if (devotionalError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Error verifying ${type} devotional: ${devotionalError.message}`,
          data: null,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    if (!devotionalData) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `${
            type.charAt(0).toUpperCase() + type.slice(1)
          } devotional not found.`,
          data: null,
        }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const { data: existingCompletion, error: completionError } = await supabase
      .from("devotional_completions")
      .select("id")
      .eq("user_id", userId)
      .eq("devotional_id", devotional_id)
      .eq("type", type)
      .maybeSingle();

    if (completionError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Error checking existing completion",
          data: null,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    if (existingCompletion) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Devotional already completed.",
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const { error: insertError } = await supabase
      .from("devotional_completions")
      .insert({
        user_id: userId,
        devotional_id: devotional_id,
        type: type,
        completed_at: completed_at,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Failed to save devotional completion: ${insertError.message}`,
          data: null,
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
        message: "Devotional completion recorded successfully.",
      }),
      {
        status: 201,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in devotional-completion:", error);
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
