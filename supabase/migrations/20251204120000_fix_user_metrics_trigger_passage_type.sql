/*
 * Migration: Fix User Metrics Trigger - Remove Passage Type Reference
 * Description: Corrige erro na trigger que tentava contar completions do tipo 'passage'
 *              que não existe no enum devotional_type (apenas 'public' e 'private')
 * Author: System
 * Date: 2024-12-04
 * 
 * ERRO CORRIGIDO:
 * "invalid input value for enum devotional_type: \"passage\""
 */

-- ============================================================================
-- FUNÇÃO CORRIGIDA: Atualizar Métricas do Usuário
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_user_metrics_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_type devotional_type;
  v_last_completion_date date;
  v_today date;
  v_days_diff integer;
  v_current_streak integer;
  v_longest_streak integer;
  v_devotionals_count integer;
  v_passages_count integer;
  v_metrics_exists boolean;
  v_current_month date;
  v_current_year integer;
  v_streak_months integer;
  v_streak_years integer;
  v_has_completion_in_month boolean;
  v_consecutive_months integer;
  v_consecutive_years integer;
  v_check_month date;
  v_check_year integer;
BEGIN
  v_user_id := NEW.user_id;
  v_type := NEW.type;
  v_today := DATE(NEW.completed_at);
  v_current_month := DATE_TRUNC('month', v_today);
  v_current_year := EXTRACT(YEAR FROM v_today)::integer;
  
  SELECT EXISTS(
    SELECT 1 FROM user_metrics WHERE user_id = v_user_id
  ) INTO v_metrics_exists;
  
  IF NOT v_metrics_exists THEN
    INSERT INTO user_metrics (
      user_id, streak_days, streak_months, streak_years,
      longest_streak, devotionals_completed, passages_completed, rank_position
    ) VALUES (v_user_id, 0, 0, 0, 0, 0, 0, NULL);
  END IF;
  
  SELECT MAX(DATE(completed_at))
  INTO v_last_completion_date
  FROM devotional_completions
  WHERE user_id = v_user_id AND id != NEW.id;
  
  SELECT streak_days, longest_streak
  INTO v_current_streak, v_longest_streak
  FROM user_metrics WHERE user_id = v_user_id;
  
  IF v_last_completion_date IS NULL THEN
    v_current_streak := 1;
  ELSE
    v_days_diff := v_today - v_last_completion_date;
    IF v_days_diff = 0 THEN
      v_current_streak := v_current_streak;
    ELSIF v_days_diff <= 3 THEN
      v_current_streak := v_current_streak + 1;
    ELSE
      v_current_streak := 1;
    END IF;
  END IF;
  
  IF v_current_streak > v_longest_streak THEN
    v_longest_streak := v_current_streak;
  END IF;
  
  v_consecutive_months := 0;
  v_check_month := v_current_month;
  
  FOR i IN 0..119 LOOP
    SELECT EXISTS(
      SELECT 1 FROM devotional_completions
      WHERE user_id = v_user_id
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
  
  v_consecutive_years := 0;
  v_check_year := v_current_year;
  
  FOR i IN 0..49 LOOP
    SELECT EXISTS(
      SELECT 1 FROM devotional_completions
      WHERE user_id = v_user_id
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
  
  -- CORREÇÃO: Removida referência ao tipo 'passage' que não existe no enum
  -- Agora conta apenas 'public' e 'private'
  SELECT 
    COUNT(*) FILTER (WHERE type = 'public') +
    COUNT(*) FILTER (WHERE type = 'private'),
    0  -- passages_completed sempre será 0 (sem tipo 'passage')
  INTO v_devotionals_count, v_passages_count
  FROM devotional_completions
  WHERE user_id = v_user_id;
  
  UPDATE user_metrics
  SET
    streak_days = v_current_streak,
    streak_months = v_streak_months,
    streak_years = v_streak_years,
    longest_streak = v_longest_streak,
    devotionals_completed = v_devotionals_count,
    passages_completed = v_passages_count,
    updated_at = now()
  WHERE user_id = v_user_id;
  
  RETURN NEW;
END;
$$;
-- ============================================================================
-- RESUMO DA CORREÇÃO
-- ============================================================================
-- PROBLEMA: A trigger tentava contar completions do tipo 'passage', mas o enum
--           devotional_type só possui os valores 'public' e 'private'
-- 
-- SOLUÇÃO: Modificada a query de contagem para usar apenas os tipos válidos
--          e definir passages_completed como 0
-- 
-- IMPACTO: Agora o endpoint devotional-completion funcionará corretamente
--          ao receber type: "public" ou type: "private"
-- ============================================================================;
