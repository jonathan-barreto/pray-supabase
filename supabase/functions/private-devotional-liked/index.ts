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

    // Obter parâmetros de paginação da URL
    const url = new URL(req.url);
    const pageParam = url.searchParams.get("page");
    const page = pageParam ? Math.max(parseInt(pageParam, 10), 1) : 1;

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

    // Contar total de devocionais curtidos pelo usuário
    const { count, error: countError } = await supabase
      .from("private_devotional_likes")
      .select("private_devotional_id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Error counting liked devotionals",
          data: null,
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
            devotionals: [],
            pagination: {
              current_page: 1,
              total_pages: 0,
              total_items: 0,
              items_per_page: ITEMS_PER_PAGE,
              has_next_page: false,
              has_previous_page: false,
            },
          },
          message: "No liked devotionals found for this user.",
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Calcular range para paginação
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    // Buscar IDs dos devocionais curtidos com paginação
    const { data: likedIds, error: likedError } = await supabase
      .from("private_devotional_likes")
      .select("private_devotional_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (likedError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Error fetching liked devotionals",
          data: null,
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
            devotionals: [],
            pagination: {
              current_page: page,
              total_pages: Math.ceil(totalCount / ITEMS_PER_PAGE),
              total_items: totalCount,
              items_per_page: ITEMS_PER_PAGE,
              has_next_page: page < Math.ceil(totalCount / ITEMS_PER_PAGE),
              has_previous_page: page > 1,
            },
          },
          message: "No liked devotionals found for this page.",
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Extrair os IDs dos devocionais curtidos
    const devotionalIds = likedIds.map((item) => item.private_devotional_id);

    // Buscar os detalhes dos devocionais curtidos
    const { data: devotionals, error: devotionalsError } = await supabase
      .from("private_devotionals")
      .select("*")
      .in("id", devotionalIds);

    if (devotionalsError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Error fetching devotional details",
          data: null,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Adicionar flag de curtido a todos os devocionais (já que estamos na lista de curtidos)
    devotionals.forEach((devotional) => {
      devotional.liked = true;
    });

    // Montar objeto de paginação
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
          devotionals: devotionals || [],
          pagination,
        },
        message: "Liked devotionals retrieved successfully.",
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error in private-devotional-liked:", error);
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
