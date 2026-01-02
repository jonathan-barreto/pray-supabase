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

    const url = new URL(req.url);
    const pageParam = url.searchParams.get("page");
    const page = pageParam ? Math.max(parseInt(pageParam, 10), 1) : 1;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { count, error: countError } = await supabase
      .from("passage_likes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Error counting liked passages",
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const totalCount = count || 0;
    if (totalCount === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            passages: [],
            pagination: {
              current_page: 1,
              total_pages: 0,
              total_items: 0,
              items_per_page: ITEMS_PER_PAGE,
              has_next_page: false,
              has_previous_page: false,
            },
          },
          message: "No liked passages found for this user.",
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const { data: likedIds, error: likesError } = await supabase
      .from("passage_likes")
      .select("daily_passage_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (likesError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Error fetching liked passage IDs",
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    if (!likedIds || likedIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            passages: [],
            pagination: {
              current_page: page,
              total_pages: 0,
              total_items: 0,
              items_per_page: ITEMS_PER_PAGE,
              has_next_page: false,
              has_previous_page: false,
            },
          },
          message: "No liked passages found for this user.",
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const passageIds = likedIds.map((i) => i.daily_passage_id);
    const { data: passages, error: passagesError } = await supabase
      .from("passages")
      .select("*")
      .in("id", passageIds)
      .order("created_at", { ascending: false });

    if (passagesError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Error fetching liked passages",
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const pagination = {
      current_page: page,
      total_pages: Math.ceil(totalCount / ITEMS_PER_PAGE),
      total_items: totalCount,
      items_per_page: ITEMS_PER_PAGE,
      has_next_page: page < Math.ceil(totalCount / ITEMS_PER_PAGE),
      has_previous_page: page > 1,
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          passages: (passages || []).map((p) => ({ ...p, liked: true })),
          pagination,
        },
        message: "User liked passages retrieved successfully.",
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
