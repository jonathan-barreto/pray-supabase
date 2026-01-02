/*
 * Migration: Create Trigger to Update User Metrics on Devotional Completion
 * Description: Cria trigger que atualiza automaticamente as métricas do usuário
 *              quando um devocional é completado, incluindo cálculo de streaks
 *              com tolerância de 2 dias sem completar
 * Author: System
 * Date: 2024-12-04
 */

-- ============================================================================
-- FUNÇÃO: Atualizar Métricas do Usuário
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
  v_completion_dates date[];
  v_check_date date;
  v_prev_date date;
  i integer;
BEGIN
  -- Capturar dados do novo registro
  v_user_id := NEW.user_id;
  v_type := NEW.type;
  v_today := DATE(NEW.completed_at);
  v_current_month := DATE_TRUNC('month', v_today);
  v_current_year := EXTRACT(YEAR FROM v_today)::integer;
  
  -- Verificar se já existe registro de métricas para o usuário
  SELECT EXISTS(
    SELECT 1 FROM user_metrics WHERE user_id = v_user_id
  ) INTO v_metrics_exists;
  
  -- Se não existe, criar registro inicial
  IF NOT v_metrics_exists THEN
    INSERT INTO user_metrics (
      user_id,
      streak_days,
      streak_months,
      streak_years,
      longest_streak,
      devotionals_completed,
      passages_completed,
      rank_position
    ) VALUES (
      v_user_id,
      0,
      0,
      0,
      0,
      0,
      0,
      NULL
    );
  END IF;
  
  -- Buscar a última data de completion (excluindo a atual)
  SELECT MAX(DATE(completed_at))
  INTO v_last_completion_date
  FROM devotional_completions
  WHERE user_id = v_user_id
    AND id != NEW.id;
  
  -- Obter streak atual e longest streak
  SELECT streak_days, longest_streak
  INTO v_current_streak, v_longest_streak
  FROM user_metrics
  WHERE user_id = v_user_id;
  
  -- ============================================================================
  -- CALCULAR STREAK DE DIAS (com tolerância de 2 dias)
  -- Recalcula todo o histórico para garantir precisão
  -- ============================================================================
  -- Buscar todas as datas únicas de completion do usuário, ordenadas DESC
  SELECT ARRAY_AGG(DISTINCT DATE(completed_at) ORDER BY DATE(completed_at) DESC)
  INTO v_completion_dates
  FROM devotional_completions
  WHERE user_id = v_user_id;
  
  -- Se não há completions, streak é 0
  IF v_completion_dates IS NULL OR array_length(v_completion_dates, 1) = 0 THEN
    v_current_streak := 0;
  ELSE
    -- Começar do dia mais recente
    v_current_streak := 1;
    v_prev_date := v_completion_dates[1];
    
    -- Iterar pelas datas para calcular streak
    FOR i IN 2..array_length(v_completion_dates, 1) LOOP
      v_check_date := v_completion_dates[i];
      v_days_diff := v_prev_date - v_check_date;
      
      -- Se a diferença é <= 3 dias (tolerância de 2 dias), continua o streak
      IF v_days_diff <= 3 THEN
        v_current_streak := v_current_streak + 1;
        v_prev_date := v_check_date;
      ELSE
        -- Quebrou o streak, parar de contar
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  -- Atualizar longest_streak se necessário
  IF v_current_streak > v_longest_streak THEN
    v_longest_streak := v_current_streak;
  END IF;
  
  -- ============================================================================
  -- CALCULAR STREAK DE MESES (meses consecutivos com pelo menos 1 completion)
  -- ============================================================================
  v_consecutive_months := 0;
  v_check_month := v_current_month;
  
  -- Loop para verificar meses consecutivos (máximo 120 meses = 10 anos)
  FOR i IN 0..119 LOOP
    -- Verificar se há completion neste mês
    SELECT EXISTS(
      SELECT 1 
      FROM devotional_completions
      WHERE user_id = v_user_id
        AND DATE_TRUNC('month', completed_at) = v_check_month
    ) INTO v_has_completion_in_month;
    
    IF v_has_completion_in_month THEN
      v_consecutive_months := v_consecutive_months + 1;
      -- Voltar para o mês anterior
      v_check_month := v_check_month - INTERVAL '1 month';
    ELSE
      -- Quebrou a sequência
      EXIT;
    END IF;
  END LOOP;
  
  v_streak_months := v_consecutive_months;
  
  -- ============================================================================
  -- CALCULAR STREAK DE ANOS (anos consecutivos com pelo menos 1 completion)
  -- ============================================================================
  v_consecutive_years := 0;
  v_check_year := v_current_year;
  
  -- Loop para verificar anos consecutivos (máximo 50 anos)
  FOR i IN 0..49 LOOP
    -- Verificar se há completion neste ano
    SELECT EXISTS(
      SELECT 1 
      FROM devotional_completions
      WHERE user_id = v_user_id
        AND EXTRACT(YEAR FROM completed_at)::integer = v_check_year
    ) INTO v_has_completion_in_month;
    
    IF v_has_completion_in_month THEN
      v_consecutive_years := v_consecutive_years + 1;
      -- Voltar para o ano anterior
      v_check_year := v_check_year - 1;
    ELSE
      -- Quebrou a sequência
      EXIT;
    END IF;
  END LOOP;
  
  v_streak_years := v_consecutive_years;
  
  -- ============================================================================
  -- CONTAR TOTAIS
  -- ============================================================================
  -- Contar total de devocionais completados por tipo
  SELECT 
    COUNT(*) FILTER (WHERE type = 'public') +
    COUNT(*) FILTER (WHERE type = 'private'),
    0  -- passages_completed não é usado (sem tipo 'passage' no enum)
  INTO v_devotionals_count, v_passages_count
  FROM devotional_completions
  WHERE user_id = v_user_id;
  
  -- ============================================================================
  -- ATUALIZAR MÉTRICAS DO USUÁRIO
  -- ============================================================================
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
-- COMENTÁRIO DA FUNÇÃO
-- ============================================================================
COMMENT ON FUNCTION public.update_user_metrics_on_completion() IS 
'Atualiza automaticamente as métricas do usuário quando um devocional é completado.

STREAK DE DIAS: Tolerância de 2 dias (reseta apenas após 3+ dias sem completar)
STREAK DE MESES: Conta meses consecutivos com pelo menos 1 completion
STREAK DE ANOS: Conta anos consecutivos com pelo menos 1 completion

Atualiza: streak_days, streak_months, streak_years, longest_streak, devotionals_completed, passages_completed';

-- ============================================================================
-- TRIGGER: Atualizar Métricas Após Inserção de Completion
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_user_metrics_on_completion ON public.devotional_completions;

CREATE TRIGGER trigger_update_user_metrics_on_completion
  AFTER INSERT ON public.devotional_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_metrics_on_completion();

-- ============================================================================
-- COMENTÁRIO DO TRIGGER INSERT
-- ============================================================================
COMMENT ON TRIGGER trigger_update_user_metrics_on_completion ON public.devotional_completions IS 
'Trigger que executa após inserção em devotional_completions para atualizar user_metrics automaticamente';

-- ============================================================================
-- TRIGGER: Atualizar Métricas Após Deleção de Completion
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_user_metrics_on_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Recalcular todas as métricas do usuário após deleção
  -- Reutiliza a mesma lógica, mas sem o NEW record
  PERFORM update_user_metrics_for_user(OLD.user_id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_user_metrics_on_deletion ON public.devotional_completions;

CREATE TRIGGER trigger_update_user_metrics_on_deletion
  AFTER DELETE ON public.devotional_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_metrics_on_deletion();

COMMENT ON TRIGGER trigger_update_user_metrics_on_deletion ON public.devotional_completions IS 
'Trigger que executa após deleção em devotional_completions para recalcular user_metrics';

-- ============================================================================
-- FUNÇÃO AUXILIAR: Recalcular Métricas para um Usuário
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
BEGIN
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
    v_current_streak := 1;
    v_prev_date := v_completion_dates[1];
    
    FOR i IN 2..array_length(v_completion_dates, 1) LOOP
      v_check_date := v_completion_dates[i];
      v_date_diff := v_prev_date - v_check_date;
      
      IF v_date_diff <= 3 THEN
        v_current_streak := v_current_streak + 1;
        v_prev_date := v_check_date;
      ELSE
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  IF v_current_streak > v_longest_streak THEN
    v_longest_streak := v_current_streak;
  END IF;
  
  -- Calcular streak de meses
  v_current_month := DATE_TRUNC('month', CURRENT_DATE);
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
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
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
'Recalcula todas as métricas de um usuário baseado em seu histórico completo de completions';

-- ============================================================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE
-- ============================================================================

-- Índice composto para otimizar consultas de última completion por usuário
CREATE INDEX IF NOT EXISTS idx_devotional_completions_user_completed 
ON public.devotional_completions (user_id, completed_at DESC);

-- ============================================================================
-- RESUMO
-- ============================================================================
-- Função criada: update_user_metrics_on_completion()
-- Trigger criado: trigger_update_user_metrics_on_completion
-- 
-- Lógica de Streak de Dias:
-- - Mesmo dia: mantém streak atual
-- - 1-3 dias de diferença: incrementa streak (tolerância de 2 dias)
-- - 4+ dias de diferença: reseta streak para 1
-- 
-- Lógica de Streak de Meses:
-- - Conta quantos meses consecutivos o usuário tem pelo menos 1 completion
-- - Exemplo: Jan(✓), Fev(✓), Mar(✓) = 3 meses de streak
-- - Se pular um mês, o streak reseta
-- 
-- Lógica de Streak de Anos:
-- - Conta quantos anos consecutivos o usuário tem pelo menos 1 completion
-- - Exemplo: 2023(✓), 2024(✓), 2025(✓) = 3 anos de streak
-- - Se pular um ano, o streak reseta
-- 
-- Métricas atualizadas automaticamente:
-- - streak_days (com tolerância de 2 dias)
-- - streak_months (meses consecutivos)
-- - streak_years (anos consecutivos)
-- - longest_streak (maior sequência de dias)
-- - devotionals_completed (total de devocionais)
-- - passages_completed (total de passagens)
-- ============================================================================
