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

    // Ajustar para o fuso horário do Brasil (UTC-3)
    const today = new Date();

    // Calcular a data e hora no Brasil (UTC-3)
    // Obtém o dia atual em UTC
    const utcDay = today.getUTCDate();
    const utcMonth = today.getUTCMonth();
    const utcYear = today.getUTCFullYear();
    const utcHour = today.getUTCHours();

    // Ajusta para o fuso brasileiro (UTC-3)
    let brazilHour = utcHour - 3;
    let brazilDay = utcDay;
    let brazilMonth = utcMonth;
    let brazilYear = utcYear;

    // Ajusta a data se necessário (se a hora ficar negativa, voltamos um dia)
    if (brazilHour < 0) {
      brazilHour += 24;
      const previousDay = new Date(Date.UTC(utcYear, utcMonth, utcDay - 1));
      brazilDay = previousDay.getUTCDate();
      brazilMonth = previousDay.getUTCMonth();
      brazilYear = previousDay.getUTCFullYear();
    }

    // Cria a data no Brasil
    const brazilDate = new Date(
      Date.UTC(brazilYear, brazilMonth, brazilDay, brazilHour)
    );
    const todayStr = brazilDate.toISOString().split("T")[0];

    // Buscar devocional público criado hoje (considerando fuso horário do Brasil UTC-3)
    const { data: publicDevotionalData, error: publicDevotionalError } =
      await supabase
        .from("public_devotionals")
        .select("*")
        .gte("created_at", `${todayStr}T03:00:00Z`)
        .lte("created_at", `${todayStr}T23:59:59Z`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (publicDevotionalError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to fetch today's public devotional.",
          data: null,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    let publicDevotional = null;
    if (publicDevotionalData) {
      const { data: publicLikeData } = await supabase
        .from("public_devotional_likes")
        .select("id")
        .eq("user_id", userId)
        .eq("public_devotional_id", publicDevotionalData.id)
        .maybeSingle();

      publicDevotional = {
        ...publicDevotionalData,
        liked: !!publicLikeData,
      };
    }

    // Buscar passagem criada hoje (considerando fuso horário do Brasil UTC-3)
    const { data: passageData, error: passageError } = await supabase
      .from("passages")
      .select("*")
      .gte("created_at", `${todayStr}T03:00:00Z`)
      .lte("created_at", `${todayStr}T23:59:59Z`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (passageError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to fetch today's passage.",
          data: null,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    let passage = null;
    if (passageData) {
      const { data: passageLikeData } = await supabase
        .from("passage_likes")
        .select("id")
        .eq("user_id", userId)
        .eq("daily_passage_id", passageData.id)
        .maybeSingle();

      passage = {
        ...passageData,
        liked: !!passageLikeData,
      };
    }

    // Obter calendário semanal
    // Usar o dia da semana baseado na data brasileira
    const currentDay = brazilDate.getUTCDay(); // 0 (domingo) a 6 (sábado)

    // Calcular o início da semana (domingo)
    const startOfWeek = new Date(
      Date.UTC(brazilYear, brazilMonth, brazilDay - currentDay)
    );

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      // Criar uma nova data UTC para cada dia da semana
      const day = new Date(
        Date.UTC(
          startOfWeek.getUTCFullYear(),
          startOfWeek.getUTCMonth(),
          startOfWeek.getUTCDate() + i
        )
      );
      weekDays.push(day);
    }

    const formattedDays = weekDays.map((day) => {
      // Extrair a data como YYYY-MM-DD diretamente do objeto Date UTC
      const dateStr = day.toISOString().split("T")[0];
      return {
        date: dateStr,
        startTime: `${dateStr}T00:00:00Z`,
        endTime: `${dateStr}T23:59:59Z`,
      };
    });

    const { data: completionsData, error: completionsError } = await supabase
      .from("devotional_completions")
      .select("completed_at, type")
      .eq("user_id", userId)
      .gte("completed_at", formattedDays[0].startTime)
      .lte("completed_at", formattedDays[6].endTime);

    if (completionsError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to fetch user's devotional completions.",
          data: null,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const completedDays = new Map();
    if (completionsData) {
      completionsData.forEach((item) => {
        const completedDate = new Date(item.completed_at)
          .toISOString()
          .split("T")[0];
        completedDays.set(completedDate, true);
      });
    }

    const dayNames = [
      "domingo",
      "segunda",
      "terça",
      "quarta",
      "quinta",
      "sexta",
      "sábado",
    ];

    const weeklyCalendar = formattedDays.map((day, index) => {
      const isToday = day.date === todayStr;
      return {
        day: dayNames[index],
        date: day.date,
        completed: completedDays.has(day.date) || false,
        isToday: isToday,
      };
    });

    const dashboardData = {
      public_devotional: publicDevotional,
      passage: passage,
      calendar: weeklyCalendar,
    };

    return new Response(
      JSON.stringify({
        success: true,
        message: "Dashboard data retrieved successfully.",
        data: dashboardData,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in dashboard:", error);
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
