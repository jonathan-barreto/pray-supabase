-- Migration: Fix cron_process_private_devotionals to log only errors
-- Description: Remove logs de 'skipped' e 'success', mantendo apenas logs de erro

CREATE OR REPLACE FUNCTION public.cron_process_private_devotionals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_pending_count INTEGER;
  v_response JSONB;
BEGIN
  -- Verificar se há devocionais privados pendentes
  SELECT COUNT(*) INTO v_pending_count
  FROM private_devotionals
  WHERE title IS NULL
    AND feeling IS NOT NULL
    AND processing = false;
  
  -- Se não há pendentes, retornar sem registrar log
  IF v_pending_count = 0 THEN
    RETURN;
  END IF;
  
  -- Chamar Edge Function
  SELECT net.http_post(
    url := 'https://pdbwdnvajqxbubjemvus.supabase.co/functions/v1/private-devotional-generate',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkYndkbnZhanF4YnViamVtdnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NDI4MDMsImV4cCI6MjA3NDIxODgwM30.nizoT-cTEchabY6XSQ1xgCP0fK7Mgc_5DtTFJXlJKx4',
      'Content-Type', 'application/json',
      'x-cron-secret', 'praify-cron-secret-2025'
    ),
    body := jsonb_build_object('trigger', 'cron', 'timestamp', now(), 'pending_count', v_pending_count)
  ) INTO v_response;
  
  -- Não registramos mais log de sucesso
  
EXCEPTION WHEN OTHERS THEN
  -- Log apenas de erro
  INSERT INTO cron_jobs_logs (job_name, status, message, error_details)
  VALUES (
    'cron_process_private_devotionals',
    'error',
    'Erro ao chamar edge function',
    jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE, 'pending_count', v_pending_count)
  );
END;
$function$;

-- Comentário para documentação
COMMENT ON FUNCTION public.cron_process_private_devotionals IS 'Processa devocionais privados pendentes chamando a Edge Function. Registra logs APENAS em caso de erro.';

-- ============================================================
-- Fix cron_generate_public_devotional to log only errors
-- ============================================================

CREATE OR REPLACE FUNCTION public.cron_generate_public_devotional()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_today DATE;
  v_existing_count INTEGER;
  v_response JSONB;
BEGIN
  -- Obter data atual
  v_today := CURRENT_DATE;
  
  -- Verificar se já existe devocional público para hoje
  SELECT COUNT(*) INTO v_existing_count
  FROM public_devotionals
  WHERE DATE(created_at) = v_today
    AND title IS NOT NULL;
  
  -- Se já existe, retornar sem registrar log
  IF v_existing_count > 0 THEN
    RETURN;
  END IF;
  
  -- Chamar Edge Function
  SELECT net.http_post(
    url := 'https://pdbwdnvajqxbubjemvus.supabase.co/functions/v1/public-devotional-generate',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkYndkbnZhanF4YnViamVtdnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NDI4MDMsImV4cCI6MjA3NDIxODgwM30.nizoT-cTEchabY6XSQ1xgCP0fK7Mgc_5DtTFJXlJKx4',
      'Content-Type', 'application/json',
      'x-cron-secret', 'praify-cron-secret-2025'
    ),
    body := jsonb_build_object('trigger', 'cron', 'timestamp', now())
  ) INTO v_response;
  
  -- Não registramos mais log de sucesso
  
EXCEPTION WHEN OTHERS THEN
  -- Log apenas de erro
  INSERT INTO cron_jobs_logs (job_name, status, message, error_details)
  VALUES (
    'cron_generate_public_devotional',
    'error',
    'Erro ao chamar edge function',
    jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
  );
END;
$function$;

-- Comentário para documentação
COMMENT ON FUNCTION public.cron_generate_public_devotional IS 'Gera devocional público diário chamando a Edge Function. Registra logs APENAS em caso de erro.';
