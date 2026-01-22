# Documentação da API Praify

Esta documentação descreve os endpoints disponíveis na API Praify.

## Índice de Edge Functions

### Usuário

- **GET** `/user` - Obter perfil do usuário autenticado
- **POST** `/user-register` - Registrar novo usuário (sem autenticação)
  - Body: `{ name, email, password, device_token? }`
- **POST** `/user-login` - Autenticar usuário e obter token JWT (sem autenticação)
  - Body: `{ email, password, device_token? }`
- **PUT** `/user-profile-update` - Atualizar nome e foto do perfil
  - Body: `{ name, photo_url? }`
- **PUT** `/user-email-update` - Atualizar email do usuário
  - Body: `{ email, password }`
- **PUT** `/user-password-update` - Atualizar senha do usuário
  - Body: `{ current_password, new_password }`
- **POST** `/user-password-reset-request` - Solicitar recuperação de senha (sem autenticação)
  - Body: `{ email }`
- **POST** `/user-password-reset-confirm` - Confirmar recuperação de senha (sem autenticação)
  - Body: `{ access_token, new_password }`
- **DELETE** `/user-delete` - Remover conta do usuário
- **GET** `/user-metrics` - Obter métricas do usuário (streaks, completions, rank)
- **GET** `/user-achievements-progress` - Obter progresso de conquistas do usuário

### Dashboard

- **GET** `/dashboard` - Obter dados consolidados para tela inicial (devocional do dia, métricas, conquistas)

### Devocionais - Completion

- **POST** `/devotional-completion` - Registrar conclusão de devocional (público ou privado)
  - Body: `{ devotional_id, type: "public"|"private", completed_at? }`

### Devocionais Privados

- **GET** `/private-devotionals` - Listar devocionais privados do usuário (paginado)
  - Query: `?page=1`
- **GET** `/private-devotional` - Obter devocional privado específico por ID
  - Query: `?id=123`
- **GET** `/latest-private-devotional` - Obter último devocional privado gerado
- **POST** `/private-devotional-create` - Salvar sentimento rapidamente (sem gerar devocional)
  - Body: `{ feeling }`
- **POST** `/private-devotional-generate` - Gerar devocional personalizado com IA baseado em sentimento
  - Body: `{ feeling }`
- **POST** `/private-devotional-like` - Curtir/descurtir devocional privado
  - Body: `{ private_devotional_id }`
- **GET** `/private-devotional-liked` - Listar devocionais privados curtidos
  - Query: `?page=1`
- **POST** `/private-devotional-feedback` - Enviar feedback sobre devocional privado
  - Body: `{ private_devotional_id, feedback_type: "positive"|"negative", feedback_text? }`

### Devocionais Públicos

- **POST** `/public-devotional-generate` - Gerar devocional público diário com IA (cron job)
  - Body: `{ authorization_key }`
- **POST** `/public-devotional-like` - Curtir/descurtir devocional público
  - Body: `{ public_devotional_id }`
- **GET** `/public-devotional-liked` - Listar devocionais públicos curtidos
  - Query: `?page=1`
- **POST** `/public-devotional-feedback` - Enviar feedback sobre devocional público
  - Body: `{ public_devotional_id, feedback_type: "positive"|"negative", feedback_text? }`

### Passagens Bíblicas

- **POST** `/passage-generate` - Gerar passagem bíblica diária com IA (cron job)
  - Body: `{ authorization_key }`
- **POST** `/passage-like` - Curtir/descurtir passagem bíblica
  - Body: `{ passage_id }`
- **GET** `/passage-liked` - Listar passagens bíblicas curtidas
  - Query: `?page=1`

## Autenticação

Todos os endpoints (exceto registro e login) requerem autenticação via token JWT. O token pode ser fornecido de duas maneiras:

1. Via header `x-user-token`
2. Via header `Authorization` com o prefixo "Bearer "

Exemplo:

```
x-user-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

ou

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Formato de Resposta

Todas as respostas seguem o mesmo formato padrão:

```json
{
  "success": true|false,
  "message": "Mensagem descritiva",
  "data": { ... } // Opcional, presente apenas em caso de sucesso
}
```

- `success`: Indica se a operação foi bem-sucedida
- `message`: Mensagem descritiva sobre o resultado da operação
- `data`: Dados retornados pela operação (presente apenas em caso de sucesso)
