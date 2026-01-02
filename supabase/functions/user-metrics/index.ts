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

interface UserMetrics {
  id: number;
  user_id: string;
  streak_days: number;
  streak_months: number;
  streak_years: number;
  longest_streak: number;
  devotionals_completed: number;
  passages_completed: number;
  rank_position: number | null;
  created_at: string;
  updated_at: string;
}

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
      .select("id, name, email")
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

    // Recalcular métricas do usuário antes de buscar
    // Isso garante que o streak_days esteja correto mesmo após dias sem completar
    const { error: recalcError } = await supabase.rpc(
      "update_user_metrics_for_user",
      { p_user_id: userId }
    );

    if (recalcError) {
      console.error("Error recalculating metrics:", recalcError);
      // Não retornar erro, apenas logar e continuar
    }

    // Buscar métricas do usuário
    const { data: metricsData, error: metricsError } = await supabase
      .from("user_metrics")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (metricsError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to fetch user metrics.",
          data: null,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Se não houver métricas, retornar null
    if (!metricsData) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "User metrics retrieved successfully.",
          data: null,
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Formatar resposta com apenas os dados das métricas (objeto direto, sem array)
    const responseData = {
      streak_days: metricsData.streak_days || 0,
      streak_months: metricsData.streak_months || 0,
      streak_years: metricsData.streak_years || 0,
      longest_streak: metricsData.longest_streak || 0,
      devotionals_completed: metricsData.devotionals_completed || 0,
      passages_completed: metricsData.passages_completed || 0,
      rank_position: metricsData.rank_position,
      created_at: metricsData.created_at,
      updated_at: metricsData.updated_at,
    };

    return new Response(
      JSON.stringify({
        success: true,
        message: "User metrics retrieved successfully.",
        data: responseData,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in user-metrics:", error);
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
