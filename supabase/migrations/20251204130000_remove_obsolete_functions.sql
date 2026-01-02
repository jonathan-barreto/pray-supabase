/*
 * Migration: Remove Obsolete Database Functions
 * Description: Remove funções do banco de dados que não estão mais sendo utilizadas
 * Author: System Cleanup
 * Date: 2024-12-04
 */

-- ============================================================================
-- FUNÇÕES DE CONTAGEM DE LIKES (Obsoletas - não utilizadas no código)
-- ============================================================================

-- Função de contagem de likes em devocionais públicos
DROP FUNCTION IF EXISTS public.count_devotional_likes(bigint);

-- Função de contagem de likes em passagens
DROP FUNCTION IF EXISTS public.count_passage_likes(bigint);

-- Função de contagem de likes em devocionais privados
DROP FUNCTION IF EXISTS public.count_user_devotional_likes(bigint);

-- ============================================================================
-- FUNÇÕES DE VERIFICAÇÃO DE LIKES (Obsoletas - não utilizadas no código)
-- ============================================================================

-- Função para verificar se usuário curtiu devocional público
DROP FUNCTION IF EXISTS public.user_liked_devotional(uuid, bigint);

-- Função para verificar se usuário curtiu passagem
DROP FUNCTION IF EXISTS public.user_liked_passage(uuid, bigint);

-- Função para verificar se usuário curtiu devocional privado
DROP FUNCTION IF EXISTS public.user_liked_user_devotional(uuid, bigint);

-- ============================================================================
-- FUNÇÕES RELACIONADAS A TABELAS QUE NÃO EXISTEM MAIS
-- ============================================================================

-- Função relacionada à tabela user_feelings que não existe mais
DROP FUNCTION IF EXISTS public.update_user_feelings_updated_at();

-- ============================================================================
-- FUNÇÕES SEM TRIGGERS ASSOCIADOS
-- ============================================================================

-- Função create_user_metrics sem trigger associado
DROP FUNCTION IF EXISTS public.create_user_metrics();

-- Função update_user_metrics_updated_at sem trigger associado
DROP FUNCTION IF EXISTS public.update_user_metrics_updated_at();

-- ============================================================================
-- RESUMO DA LIMPEZA
-- ============================================================================
-- Total de funções removidas: 9
-- 
-- Funções mantidas (ainda em uso):
-- - cron_generate_daily_passage
-- - cron_generate_public_devotional
-- - cron_process_private_devotionals
-- - update_updated_at_column (usada por triggers em feedback tables)
-- ============================================================================
