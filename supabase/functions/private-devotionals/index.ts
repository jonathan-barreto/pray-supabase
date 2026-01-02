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

    // Obter parâmetros de paginação da URL
    const url = new URL(req.url);
    const pageParam = url.searchParams.get("page");
    const page = pageParam ? Math.max(parseInt(pageParam, 10), 1) : 1;

    // Inicializar cliente Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Contar total de devocionais privados do usuário
    const { count, error: countError } = await supabase
      .from("private_devotionals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Error counting user devotionals",
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
          message: "No devotionals found for this user.",
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

    // Buscar devocionais do usuário com paginação
    const { data: devotionals, error: devotionalsError } = await supabase
      .from("private_devotionals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (devotionalsError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Error fetching user devotionals",
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar quais devocionais o usuário curtiu
    if (devotionals && devotionals.length > 0) {
      const devotionalIds = devotionals.map((d) => d.id);

      const { data: likedDevotionals } = await supabase
        .from("devotional_likes")
        .select("private_devotional_id")
        .eq("user_id", userId)
        .in("private_devotional_id", devotionalIds)
        .is("public_devotional_id", null);

      const likedIds = new Set(
        (likedDevotionals || []).map((like) => like.private_devotional_id)
      );

      // Adicionar flag de curtido aos devocionais
      devotionals.forEach((devotional) => {
        devotional.liked = likedIds.has(devotional.id);
      });
    }

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
        message: "User devotionals retrieved successfully.",
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error in private-devotionals:", error);
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
