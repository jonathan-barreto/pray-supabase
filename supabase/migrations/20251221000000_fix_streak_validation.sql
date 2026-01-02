/*
 * Migration: Fix Streak Validation Against Current Date
 * Description: Corrige a função update_user_metrics_for_user para validar
 *              se o streak ainda é válido comparando a data mais recente
 *              de completion com a data atual (tolerância de 3 dias)
 * Author: System
 * Date: 2024-12-21
 */

-- ============================================================================
-- FUNÇÃO AUXILIAR: Recalcular Métricas para um Usuário (CORRIGIDA)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_user_metrics_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_streak integer;
  v_longest_streak integer;
  v_devotionals_count integer;
  v_passages_count integer;
  v_metrics_exists boolean;
  v_streak_months integer;
  v_streak_years integer;
  v_has_completion_in_month boolean;
  v_consecutive_months integer;
  v_consecutive_years integer;
  v_check_month date;
  v_check_year integer;
  v_current_month date;
  v_current_year integer;
  v_completion_dates date[];
  v_check_date date;
  v_prev_date date;
  v_date_diff integer;
  v_today date;
  v_days_since_last_completion integer;
BEGIN
  -- Data atual
  v_today := CURRENT_DATE;
  
  -- Verificar se já existe registro de métricas
  SELECT EXISTS(
    SELECT 1 FROM user_metrics WHERE user_id = p_user_id
  ) INTO v_metrics_exists;
  
  IF NOT v_metrics_exists THEN
    INSERT INTO user_metrics (
      user_id, streak_days, streak_months, streak_years,
      longest_streak, devotionals_completed, passages_completed, rank_position
    ) VALUES (p_user_id, 0, 0, 0, 0, 0, 0, NULL);
  END IF;
  
  -- Obter longest_streak atual
  SELECT longest_streak INTO v_longest_streak
  FROM user_metrics WHERE user_id = p_user_id;
  
  -- Calcular streak de dias
  SELECT ARRAY_AGG(DISTINCT DATE(completed_at) ORDER BY DATE(completed_at) DESC)
  INTO v_completion_dates
  FROM devotional_completions
  WHERE user_id = p_user_id;
  
  IF v_completion_dates IS NULL OR array_length(v_completion_dates, 1) = 0 THEN
    v_current_streak := 0;
  ELSE
    -- VALIDAÇÃO CRÍTICA: Verificar se a data mais recente está dentro da tolerância
    v_days_since_last_completion := v_today - v_completion_dates[1];
    
    -- Se passou mais de 3 dias desde o último completion, streak é zerado
    IF v_days_since_last_completion > 3 THEN
      v_current_streak := 0;
    ELSE
      -- Começar do dia mais recente
      v_current_streak := 1;
      v_prev_date := v_completion_dates[1];
      
      -- Iterar pelas datas para calcular streak
      FOR i IN 2..array_length(v_completion_dates, 1) LOOP
        v_check_date := v_completion_dates[i];
        v_date_diff := v_prev_date - v_check_date;
        
        -- Se a diferença é <= 3 dias (tolerância de 2 dias), continua o streak
        IF v_date_diff <= 3 THEN
          v_current_streak := v_current_streak + 1;
          v_prev_date := v_check_date;
        ELSE
          -- Quebrou o streak, parar de contar
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  -- Atualizar longest_streak se necessário
  IF v_current_streak > v_longest_streak THEN
    v_longest_streak := v_current_streak;
  END IF;
  
  -- Calcular streak de meses
  v_current_month := DATE_TRUNC('month', v_today);
  v_consecutive_months := 0;
  v_check_month := v_current_month;
  
  FOR i IN 0..119 LOOP
    SELECT EXISTS(
      SELECT 1 FROM devotional_completions
      WHERE user_id = p_user_id
        AND DATE_TRUNC('month', completed_at) = v_check_month
    ) INTO v_has_completion_in_month;
    
    IF v_has_completion_in_month THEN
      v_consecutive_months := v_consecutive_months + 1;
      v_check_month := v_check_month - INTERVAL '1 month';
    ELSE
      EXIT;
    END IF;
  END LOOP;
  
  v_streak_months := v_consecutive_months;
  
  -- Calcular streak de anos
  v_current_year := EXTRACT(YEAR FROM v_today)::integer;
  v_consecutive_years := 0;
  v_check_year := v_current_year;
  
  FOR i IN 0..49 LOOP
    SELECT EXISTS(
      SELECT 1 FROM devotional_completions
      WHERE user_id = p_user_id
        AND EXTRACT(YEAR FROM completed_at)::integer = v_check_year
    ) INTO v_has_completion_in_month;
    
    IF v_has_completion_in_month THEN
      v_consecutive_years := v_consecutive_years + 1;
      v_check_year := v_check_year - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  
  v_streak_years := v_consecutive_years;
  
  -- Contar totais
  SELECT 
    COUNT(*) FILTER (WHERE type = 'public') +
    COUNT(*) FILTER (WHERE type = 'private'),
    0
  INTO v_devotionals_count, v_passages_count
  FROM devotional_completions
  WHERE user_id = p_user_id;
  
  -- Atualizar métricas
  UPDATE user_metrics
  SET
    streak_days = v_current_streak,
    streak_months = v_streak_months,
    streak_years = v_streak_years,
    longest_streak = v_longest_streak,
    devotionals_completed = v_devotionals_count,
    passages_completed = v_passages_count,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.update_user_metrics_for_user(uuid) IS 
'Recalcula todas as métricas de um usuário baseado em seu histórico completo de completions.
IMPORTANTE: Valida se o streak ainda é válido comparando a data mais recente com a data atual (tolerância de 3 dias).';

-- ============================================================================
-- RESUMO DA CORREÇÃO
-- ============================================================================
-- Adicionada validação crítica:
-- - Se passou mais de 3 dias desde o último completion, streak_days = 0
-- - Isso garante que o streak seja zerado automaticamente quando o usuário
--   fica muito tempo sem completar devocionais
-- ============================================================================
