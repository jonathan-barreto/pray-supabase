# Recuperação de Senha

Este documento descreve o fluxo completo de recuperação de senha do Praify.

## Fluxo de Recuperação

### 1. Solicitar Reset de Senha

**Endpoint:** `POST /user-password-reset-request`

**Autenticação:** Não requerida

**Descrição:** Envia um email com link de recuperação para o usuário. Por segurança, sempre retorna sucesso mesmo se o email não existir no sistema.

**Request Body:**

```json
{
  "email": "usuario@exemplo.com"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Se o email estiver cadastrado, você receberá instruções para redefinir sua senha."
}
```

**Validações:**

- Email é obrigatório
- Email deve ter formato válido

**Erros:**

- `400` - Email não fornecido ou inválido
- `500` - Erro ao processar solicitação

---

### 2. Confirmar Reset de Senha

**Endpoint:** `POST /user-password-reset-confirm`

**Autenticação:** Não requerida (usa token do email)

**Descrição:** Valida o token recebido por email e atualiza a senha do usuário.

**Request Body:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "new_password": "NovaSenha123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Senha redefinida com sucesso."
}
```

**Validações:**

- Token de acesso é obrigatório
- Nova senha é obrigatória
- Senha deve ter pelo menos 8 caracteres
- Senha deve conter pelo menos uma letra maiúscula
- Senha deve conter pelo menos uma letra minúscula
- Senha deve conter pelo menos um número

**Erros:**

- `400` - Token ou senha não fornecidos
- `400` - Senha não atende aos requisitos de segurança
- `401` - Token inválido ou expirado
- `500` - Erro ao atualizar senha

---

## Fluxo Completo no Frontend

### Passo 1: Tela de "Esqueci Minha Senha"

```typescript
async function requestPasswordReset(email: string) {
  const response = await fetch(
    "https://seu-projeto.supabase.co/functions/v1/user-password-reset-request",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    },
  );

  const data = await response.json();

  if (data.success) {
    // Mostrar mensagem: "Verifique seu email"
  }
}
```

### Passo 2: Usuário Clica no Link do Email

O Supabase enviará um email com um link no formato:

```
https://seu-app.com/reset-password?access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Passo 3: Tela de Nova Senha

```typescript
async function confirmPasswordReset(accessToken: string, newPassword: string) {
  const response = await fetch(
    "https://seu-projeto.supabase.co/functions/v1/user-password-reset-confirm",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: accessToken,
        new_password: newPassword,
      }),
    },
  );

  const data = await response.json();

  if (data.success) {
    // Redirecionar para tela de login
    // Mostrar mensagem: "Senha redefinida com sucesso"
  } else {
    // Mostrar erro (token expirado, senha fraca, etc)
  }
}
```

### Passo 4: Extrair Token da URL

```typescript
// Em React/Next.js
import { useSearchParams } from "next/navigation";

function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const accessToken = searchParams.get("access_token");

  // Usar accessToken na função confirmPasswordReset
}
```

---

## Configuração Necessária

### Variável de Ambiente

Adicione a variável `APP_URL` nas configurações do Supabase para definir a URL de redirecionamento:

```bash
APP_URL=https://seu-app.com
```

### Template de Email (Opcional)

Você pode personalizar o template de email no Supabase Dashboard:

1. Acesse: **Authentication → Email Templates**
2. Selecione: **Reset Password**
3. Customize o HTML/texto do email

---

## Segurança

### Proteções Implementadas

✅ **Token temporário**: Válido por 1 hora (configurável no Supabase)  
✅ **Uso único**: Token expira após ser usado  
✅ **Validação de senha forte**: Mínimo 8 caracteres, maiúscula, minúscula e número  
✅ **Não expõe existência de email**: Sempre retorna sucesso na solicitação  
✅ **Rate limiting**: Supabase limita tentativas por IP  
✅ **Email via SMTP seguro**: Resend configurado com TLS/SSL

### Boas Práticas

- Não armazene o `access_token` em localStorage
- Use o token imediatamente após recebê-lo
- Implemente timeout na tela de reset (ex: 10 minutos)
- Mostre feedback claro sobre requisitos de senha
- Redirecione para login após sucesso

---

## Troubleshooting

### Email não chega

1. Verifique spam/lixeira
2. Confirme configuração SMTP no Supabase Dashboard
3. Verifique logs no Supabase: **Authentication → Logs**

### Token inválido/expirado

- Tokens expiram em 1 hora
- Usuário deve solicitar novo reset
- Verifique se o token está sendo extraído corretamente da URL

### Erro 500 ao confirmar

- Verifique se `SUPABASE_URL` e `SUPABASE_ANON_KEY` estão configurados
- Confirme que as Edge Functions foram deployadas
- Verifique logs: `supabase functions logs user-password-reset-confirm`
