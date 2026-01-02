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
          data: null,
        }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const private_devotional_id =
      body.private_devotional_id || body.user_devotional_id; // Aceitar ambos para compatibilidade
    if (!private_devotional_id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "private_devotional_id is required.",
          data: null,
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }
    if (
      typeof private_devotional_id !== "number" ||
      !Number.isInteger(private_devotional_id) ||
      private_devotional_id <= 0
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "private_devotional_id must be a positive integer.",
          data: null,
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
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

    const { data: devotionalData, error: devotionalError } = await supabase
      .from("private_devotionals")
      .select("id")
      .eq("id", private_devotional_id)
      .maybeSingle();
    if (devotionalError || !devotionalData) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "User devotional not found.",
          data: null,
        }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const { data: existingLike, error: checkError } = await supabase
      .from("private_devotional_likes")
      .select("id")
      .eq("user_id", userId)
      .eq("private_devotional_id", private_devotional_id)
      .maybeSingle();

    if (checkError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to check existing like.",
          data: null,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    if (existingLike) {
      const { error: deleteError } = await supabase
        .from("private_devotional_likes")
        .delete()
        .eq("id", existingLike.id);
      if (deleteError) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Failed to remove like.",
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
          message: "Like removed successfully.",
          data: { private_devotional_id, liked: false, action: "unliked" },
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const { error: insertError } = await supabase
      .from("private_devotional_likes")
      .insert({
        user_id: userId,
        private_devotional_id,
      });

    if (insertError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to create like.",
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
        message: "Like added successfully.",
        data: { private_devotional_id, liked: true, action: "liked" },
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error in private-devotional-like:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error?.message || "Internal server error.",
        data: null,
      }),
      {
        status: error?.status || 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
