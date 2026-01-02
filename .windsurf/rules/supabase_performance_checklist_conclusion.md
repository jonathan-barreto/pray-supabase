---
trigger: always_on
---

# Regras e Melhores Práticas para Supabase - Parte 3: Desempenho, Checklists e Conclusão

## Índice

1. [Desempenho](#desempenho)
   - [Otimização de Banco de Dados](#otimização-de-banco-de-dados)
   - [Otimização de Consultas](#otimização-de-consultas)
   - [Otimização de Edge Functions](#otimização-de-edge-functions)
   - [Monitoramento e Profiling](#monitoramento-e-profiling)
   - [Escalabilidade](#escalabilidade)
2. [Checklists](#checklists)
   - [Checklist de Segurança](#checklist-de-segurança)
   - [Checklist de Organização](#checklist-de-organização)
   - [Checklist de Desempenho](#checklist-de-desempenho)
3. [Conclusão](#conclusão)

## Desempenho

O desempenho é um fator crítico para a experiência do usuário e a escalabilidade de aplicações baseadas em Supabase. Esta seção apresenta diretrizes e melhores práticas para otimizar o desempenho do banco de dados, consultas e Edge Functions.

### Otimização de Banco de Dados

#### Índices

1. **Crie Índices Estrategicamente**
   ```sql
   -- Índice para campos frequentemente consultados
   CREATE INDEX idx_users_email ON users(email);
   
   -- Índice composto para consultas com múltiplos campos
   CREATE INDEX idx_lesson_completion_user_date ON lesson_completion(user_id, completed_at);
   
   -- Índice parcial para subconjuntos frequentes
   CREATE INDEX idx_active_users ON users(id) WHERE status = 'active';
   ```

2. **Tipos de Índices**
   - **B-tree**: Índice padrão, bom para comparações de igualdade e range
   - **GIN**: Para campos jsonb e arrays
   - **GIST**: Para dados geoespaciais e full-text search
   - **BRIN**: Para tabelas muito grandes com dados ordenados

3. **Evite Índices Desnecessários**
   - Não crie índices em colunas raramente consultadas
   - Monitore o uso de índices com `pg_stat_user_indexes`
   - Remova índices não utilizados

4. **Manutenção de Índices**
   ```sql
   -- Reconstruir índice para melhorar desempenho
   REINDEX INDEX idx_users_email;
   
   -- Analisar tabela para atualizar estatísticas
   ANALYZE users;
   ```

#### Particionamento

1. **Particione Tabelas Grandes**
   ```sql
   -- Particionamento por range (ex: por data)
   CREATE TABLE logs (
     id BIGINT,
     created_at TIMESTAMPTZ,
     message TEXT
   ) PARTITION BY RANGE (created_at);
   
   -- Criar partições
   CREATE TABLE logs_2025_q1 PARTITION OF logs
     FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
   
   CREATE TABLE logs_2025_q2 PARTITION OF logs
     FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
   ```

2. **Estratégias de Particionamento**
   - **Range**: Para dados sequenciais como datas
   - **List**: Para categorias discretas
   - **Hash**: Para distribuição uniforme

3. **Quando Usar Particionamento**
   - Tabelas com mais de 10 milhões de linhas
   - Tabelas com padrões de acesso previsíveis
   - Dados com ciclo de vida claro (arquivamento)

#### Normalização vs. Desnormalização

1. **Normalização para Consistência**
   - Use normalização (3NF) para dados que mudam frequentemente
   - Evite redundância para facilitar atualizações

2. **Desnormalização para Desempenho**
   - Considere desnormalização para consultas frequentes de leitura
   - Use campos calculados para evitar joins custosos
   ```sql
   -- Campo calculado para contagem
   ALTER TABLE users ADD COLUMN achievement_count INTEGER DEFAULT 0;
   
   -- Atualizar com trigger
   CREATE OR REPLACE FUNCTION update_achievement_count()
   RETURNS TRIGGER AS $$
   BEGIN
     UPDATE users
     SET achievement_count = (
       SELECT COUNT(*) FROM user_achievements
       WHERE user_id = NEW.user_id
     )
     WHERE id = NEW.user_id;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```

3. **Materialized Views**
   ```sql
   -- Criar view materializada para relatórios
   CREATE MATERIALIZED VIEW user_stats AS
   SELECT 
     u.id,
     u.name,
     COUNT(lc.id) AS total_lessons,
     SUM(lc.duration) AS total_seconds,
     SUM(lc.calories) AS total_calories
   FROM 
     users u
     LEFT JOIN lesson_completion lc ON u.id = lc.user_id
   GROUP BY 
     u.id, u.name;
   
   -- Atualizar periodicamente
   REFRESH MATERIALIZED VIEW user_stats;
   ```

### Otimização de Consultas

#### Escrita de Consultas Eficientes

1. **Selecione Apenas Colunas Necessárias**
   ```sql
   -- Bom: seleciona apenas o necessário
   SELECT id, name, email FROM users WHERE id = 123;
   
   -- Ruim: seleciona todas as colunas
   SELECT * FROM users WHERE id = 123;
   ```

2. **Use JOINs Eficientemente**
   - Prefira INNER JOIN quando possível
   - Use LEFT JOIN apenas quando necessário
   - Evite múltiplos JOINs em tabelas grandes

3. **Limite Resultados**
   ```sql
   -- Paginação eficiente
   SELECT id, title FROM lessons
   ORDER BY created_on
   LIMIT 10 OFFSET 20;
   
   -- Paginação com cursor (mais eficiente para conjuntos grandes)
   SELECT id, title FROM lessons
   WHERE created_on > '2025-01-01'
   ORDER BY created_on
   LIMIT 10;
   ```

4. **Evite Funções em Cláusulas WHERE**
   ```sql
   -- Ruim: função na cláusula WHERE
   SELECT * FROM users WHERE LOWER(email) = 'user@example.com';
   
   -- Bom: índice funcional + consulta otimizada
   CREATE INDEX idx_users_email_lower ON users(LOWER(email));
   SELECT * FROM users WHERE LOWER(email) = 'user@example.com';
   ```

#### Análise e Otimização

1. **Use EXPLAIN ANALYZE**
   ```sql
   EXPLAIN ANALYZE
   SELECT u.name, COUNT(lc.id) as lesson_count
   FROM users u
   JOIN lesson_completion lc ON u.id = lc.user_id
   GROUP BY u.id, u.name;
   ```

2. **Identifique Gargalos**
   - Seq Scan em tabelas grandes
   - Operações de ordenação em memória
   - Hash joins em tabelas grandes

3. **Otimize Consultas Problemáticas**
   - Adicione índices apropriados
   - Reescreva JOINs complexos
   - Considere views materializadas

#### Caching

1. **Cache de Consultas no Supabase**
   - Use `pgbouncer` para pooling de conexões
   - Configure `statement_timeout` para evitar consultas longas

2. **Cache no Cliente**
   ```typescript
   // Cache de dados no cliente com TTL
   const { data, error } = await supabase
     .from('user_metrics')
     .select('*')
     .eq('user_id', userId)
     .single()
     .ttl(60); // Cache por 60 segundos
   ```

3. **Cache Distribuído**
   - Use Redis para cache compartilhado entre serviços
   - Implemente invalidação de cache quando dados mudam

### Otimização de Edge Functions

#### Eficiência de Código

1. **Minimize Dependências Externas**
   ```typescript
   // Bom: usa bibliotecas nativas ou pequenas
   import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
   
   // Evite: importar bibliotecas grandes desnecessárias
   // import { _ } from "https://cdn.skypack.dev/lodash";
   ```

2. **Use Async/Await Eficientemente**
   ```typescript
   // Bom: executa operações em paralelo quando possível
   const [userResult, metricsResult] = await Promise.all([
     supabase.from('users').select('*').eq('id', userId),
     supabase.from('user_metrics').select('*').eq('user_id', userId)
   ]);
   
   // Ruim: executa sequencialmente
   const userResult = await supabase.from('users').select('*').eq('id', userId);
   const metricsResult = await supabase.from('user_metrics').select('*').eq('user_id', userId);
   ```

3. **Minimize Operações de Banco de Dados**
   - Combine múltiplas operações em uma única consulta
   - Use transações para operações relacionadas

#### Otimização de Resposta

1. **Compressão de Resposta**
   ```typescript
   const headers = {
     'Content-Type': 'application/json',
     'Content-Encoding': 'gzip'
   };
   
   // Implementar compressão gzip para respostas grandes
   ```

2. **Minimize Tamanho de Payload**
   - Retorne apenas dados necessários
   - Use campos calculados no servidor em vez de processamento no cliente

3. **Streaming para Respostas Grandes**
   ```typescript
   // Para conjuntos de dados grandes, considere streaming
   const stream = new ReadableStream({
     start(controller) {
       // Enviar dados em chunks
     }
   });
   
   return new Response(stream, { headers });
   ```

### Monitoramento e Profiling

1. **Monitore Métricas Chave**
   - Tempo de resposta de consultas
   - Taxa de cache hits/misses
   - Uso de CPU e memória
   - Tamanho do banco de dados

2. **Use Ferramentas de Profiling**
   - pg_stat_statements para análise de consultas
   - pgBadger para análise de logs
   - Supabase Dashboard para métricas gerais

3. **Alertas e Limites**
   - Configure alertas para consultas lentas
   - Defina limites de recursos para evitar sobrecarga

### Escalabilidade

1. **Escale Verticalmente (Primeiro)**
   - Aumente recursos da instância Supabase
   - Otimize antes de escalar

2. **Escale Horizontalmente (Quando Necessário)**
   - Use réplicas de leitura para consultas pesadas
   - Implemente sharding para dados muito grandes

3. **Arquitetura para Escala**
   - Projete para particionamento futuro
   - Considere microserviços para componentes isolados
   - Use filas para operações assíncronas

## Checklists

### Checklist de Segurança

- [ ] RLS habilitado em todas as tabelas
- [ ] Políticas RLS definidas para cada operação (SELECT, INSERT, UPDATE, DELETE)
- [ ] Validação de entrada implementada em todos os endpoints
- [ ] Autenticação JWT configurada e validada
- [ ] Dados sensíveis criptografados
- [ ] CORS configurado adequadamente
- [ ] Variáveis de ambiente protegidas
- [ ] Logs de auditoria ativados
- [ ] Testes de segurança realizados

### Checklist de Organização

- [ ] Esquemas definidos para separar contextos
- [ ] Convenções de nomenclatura aplicadas consistentemente
- [ ] Tipos de dados apropriados para cada campo
- [ ] Estrutura de código padronizada para Edge Functions
- [ ] Sistema de migrations implementado
- [ ] Documentação completa para tabelas, funções e endpoints
- [ ] Ambientes separados para desenvolvimento, staging e produção

### Checklist de Desempenho

- [ ] Índices criados para campos frequentemente consultados
- [ ] Consultas otimizadas para selecionar apenas dados necessários
- [ ] Estratégia de particionamento para tabelas grandes
- [ ] Views materializadas para consultas complexas frequentes
- [ ] Monitoramento configurado para identificar gargalos
- [ ] Edge Functions otimizadas para minimizar latência
- [ ] Estratégia de cache implementada
- [ ] Plano de escalabilidade definido

## Conclusão

Este documento apresentou um conjunto abrangente de melhores práticas para desenvolvimento com Supabase, focando em segurança, organização e desempenho. Seguir estas diretrizes ajudará a garantir que suas aplicações sejam seguras, bem estruturadas e escalem eficientemente conforme a base de usuários cresce.

Lembre-se de que estas práticas devem ser adaptadas às necessidades específicas do seu projeto e evoluir conforme novas tecnologias e padrões emergem no ecossistema Supabase.

Para mais informações, consulte a [documentação oficial do Supabase](https://supabase.com/docs) e o [blog do Supabase](https://supabase.com/blog) para as últimas atualizações e melhores práticas.
