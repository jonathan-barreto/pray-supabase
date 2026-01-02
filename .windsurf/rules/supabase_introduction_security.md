---
trigger: always_on
---

# Regras e Melhores Práticas para Supabase - Parte 1: Introdução e Segurança

## Índice

1. [Introdução](#introdução)
   - [Propósito](#propósito)
   - [Como Usar Esta Documentação](#como-usar-esta-documentação)
2. [Segurança](#segurança)
   - [Row Level Security (RLS)](#row-level-security-rls)
   - [Autenticação e Autorização](#autenticação-e-autorização)
   - [Proteção de Endpoints](#proteção-de-endpoints)
   - [Proteção de Dados](#proteção-de-dados)
   - [Configuração e Ambiente](#configuração-e-ambiente)

## Introdução

Este documento apresenta regras e melhores práticas para desenvolvimento com Supabase, focando em três pilares principais: segurança, organização e desempenho. Estas diretrizes são destinadas tanto para desenvolvedores quanto para IAs que trabalham com o projeto Academia Foguete ou qualquer outro projeto baseado em Supabase.

### Propósito

O objetivo desta documentação é estabelecer um conjunto claro de regras e melhores práticas para garantir que o desenvolvimento com Supabase seja:

- **Seguro**: Protegendo dados sensíveis e prevenindo vulnerabilidades de segurança
- **Organizado**: Mantendo uma estrutura de código consistente e fácil de manter
- **Eficiente**: Garantindo desempenho ótimo mesmo com crescimento da base de usuários

### Como Usar Esta Documentação

- **Para Desenvolvedores**: Use como referência ao implementar novos recursos ou modificar recursos existentes
- **Para IAs**: Use como contexto para gerar código, sugestões e recomendações alinhadas com as melhores práticas

## Segurança

A segurança é um aspecto crítico no desenvolvimento com Supabase. Esta seção apresenta diretrizes e melhores práticas para garantir que sua aplicação seja segura contra vulnerabilidades comuns e proteja adequadamente os dados dos usuários.

### Row Level Security (RLS)

#### Regras Fundamentais

1. **Habilite RLS em Todas as Tabelas**
   ```sql
   ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
   ```

2. **Negue por Padrão, Permita Explicitamente**
   - Comece com políticas restritivas e adicione permissões específicas
   - Evite políticas que permitam acesso amplo

3. **Defina Políticas para Cada Operação**
   ```sql
   CREATE POLICY "Usuários podem ver apenas seus próprios dados" 
   ON your_table FOR SELECT 
   USING (auth.uid() = user_id);
   
   CREATE POLICY "Usuários podem editar apenas seus próprios dados" 
   ON your_table FOR UPDATE 
   USING (auth.uid() = user_id);
   ```

4. **Teste Exaustivamente as Políticas RLS**
   - Teste com diferentes perfis de usuário
   - Verifique se dados de outros usuários não são acessíveis

#### Exemplos de Políticas RLS

##### Tabela de Usuários
```sql
-- Usuários podem ver apenas seus próprios dados
CREATE POLICY "Usuários podem ver apenas seus próprios dados" 
ON users FOR SELECT 
USING (auth.uid() = id);

-- Usuários podem editar apenas seus próprios dados
CREATE POLICY "Usuários podem editar apenas seus próprios dados" 
ON users FOR UPDATE 
USING (auth.uid() = id);

-- Administradores podem ver todos os usuários
CREATE POLICY "Administradores podem ver todos os usuários" 
ON users FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
```

##### Tabela de Métricas
```sql
-- Usuários podem ver apenas suas próprias métricas
CREATE POLICY "Usuários podem ver apenas suas próprias métricas" 
ON user_metrics FOR SELECT 
USING (auth.uid() = user_id);

-- Métricas são atualizadas apenas por triggers
CREATE POLICY "Métricas são atualizadas apenas por triggers" 
ON user_metrics FOR UPDATE 
USING (FALSE);
```

### Autenticação e Autorização

#### Tokens JWT

1. **Valide Sempre os Tokens**
   ```typescript
   // Em Edge Functions
   const authHeader = req.headers.get('authorization');
   const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
   
   if (token !== Deno.env.get('SUPABASE_ANON_KEY')) {
     return new Response(JSON.stringify({
       success: false,
       message: 'Unauthorized.'
     }), {
       status: 401,
       headers: { 'Content-Type': 'application/json' }
     });
   }
   ```

2. **Defina Expiração Adequada para Tokens**
   - Tokens de acesso: curta duração (1-2 horas)
   - Tokens de refresh: duração moderada (2 semanas)

3. **Use Roles para Controle de Acesso**
   - Crie roles específicas para diferentes níveis de acesso
   - Associe políticas RLS às roles

### Proteção de Endpoints

1. **Valide Todos os Inputs**
   ```typescript
   // Validação de ID
   if (typeof id !== 'number' || !Number.isInteger(id) || id < 0) {
     return new Response(JSON.stringify({
       success: false,
       message: 'Invalid or missing id.'
     }), {
       status: 400,
       headers: { 'Content-Type': 'application/json' }
     });
   }
   ```

2. **Use Prepared Statements**
   ```typescript
   // Correto
   const { data } = await supabase
     .from('users')
     .select('*')
     .eq('id', userId);
   
   // Incorreto (vulnerável a injeção SQL)
   const { data } = await supabase.rpc('get_user_by_id', { id: userId });
   ```

3. **Limite Taxa de Requisições**
   - Implemente rate limiting em endpoints críticos
   - Use serviços como Upstash ou Redis para controle de taxa

### Proteção de Dados

1. **Nunca Armazene Senhas em Texto Plano**
   - Use o sistema de autenticação do Supabase
   - Para senhas personalizadas, use bcrypt ou Argon2

2. **Criptografe Dados Sensíveis**
   ```sql
   -- Função para criptografar dados
   CREATE OR REPLACE FUNCTION encrypt_data(data text, key text)
   RETURNS text AS $$
   BEGIN
     RETURN pgp_sym_encrypt(data, key);
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   
   -- Função para descriptografar dados
   CREATE OR REPLACE FUNCTION decrypt_data(encrypted_data text, key text)
   RETURNS text AS $$
   BEGIN
     RETURN pgp_sym_decrypt(encrypted_data::bytea, key);
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

3. **Use Funções SECURITY DEFINER com Cautela**
   - Limite o escopo das funções SECURITY DEFINER
   - Valide inputs rigorosamente

4. **Sanitize Dados de Saída**
   - Evite XSS sanitizando dados antes de exibi-los
   - Use bibliotecas como DOMPurify no frontend

### Configuração e Ambiente

1. **Proteja Variáveis de Ambiente**
   - Nunca exponha SERVICE_ROLE_KEY no cliente
   - Use ANON_KEY para operações do cliente

2. **Configure CORS Adequadamente**
   ```typescript
   // Em Edge Functions
   const headers = {
     'Content-Type': 'application/json',
     'Access-Control-Allow-Origin': 'https://seu-dominio.com',
     'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
     'Access-Control-Allow-Headers': 'Content-Type, Authorization'
   };
   ```

3. **Audite Regularmente Permissões**
   - Revise políticas RLS periodicamente
   - Verifique funções e procedimentos armazenados

4. **Ative Logs de Auditoria**
   - Configure pgAudit para registrar operações críticas
   - Monitore tentativas de acesso não autorizado

