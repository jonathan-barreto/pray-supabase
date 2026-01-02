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

  try {
    let token = req.headers.get("x-user-token");
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }
    if (!token) {
      throw { status: 401, message: "User token not provided." };
    }

    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    const userId = payload.sub;
    if (!userId) {
      throw { status: 401, message: "Invalid or expired token." };
    }

    const { passage_id } = await req.json();
    if (!passage_id || typeof passage_id !== "number" || passage_id <= 0) {
      throw { status: 400, message: "passage_id must be a positive integer." };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [{ data: user }, { data: passage }] = await Promise.all([
      supabase.from("users").select("id").eq("id", userId).maybeSingle(),
      supabase.from("passages").select("id").eq("id", passage_id).maybeSingle(),
    ]);
    if (!user) {
      throw { status: 404, message: "User not found." };
    }
    if (!passage) {
      throw { status: 404, message: "Passage not found." };
    }

    const { data: existingLike } = await supabase
      .from("passage_likes")
      .select("id")
      .eq("user_id", userId)
      .eq("daily_passage_id", passage_id)
      .maybeSingle();

    if (existingLike) {
      await supabase.from("passage_likes").delete().eq("id", existingLike.id);
      return new Response(
        JSON.stringify({
          success: true,
          data: { passage_id, liked: false, action: "unliked" },
          message: "Like removed successfully.",
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    await supabase
      .from("passage_likes")
      .insert({ user_id: userId, daily_passage_id: passage_id });
    return new Response(
      JSON.stringify({
        success: true,
        data: { passage_id, liked: true, action: "liked" },
        message: "Like added successfully.",
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
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
