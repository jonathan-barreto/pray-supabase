# Endpoints de Usuário

Esta documentação descreve os endpoints relacionados ao gerenciamento de usuários na API.

## GET /user

Retorna os dados do perfil do usuário autenticado.

### Autenticação

- Requer token JWT (via header `x-user-token` e `Authorization Bearer`)

### Resposta

```json
{
  "success": true,
  "data": {
    "id": "2ef696f2-29f1-4864-b9de-f226b1a12a95",
    "name": "Jonathan Barreto",
    "email": "jonathan.barreto@snowmanlabs.com",
    "created_at": "2025-10-24T02:47:09.280018+00:00",
    "updated_at": "2025-11-16T22:47:09.217+00:00",
    "metrics": {
      "id": 1,
      "user_id": "2ef696f2-29f1-4864-b9de-f226b1a12a95",
      "streak_days": 0,
      "streak_months": 0,
      "streak_years": 0,
      "longest_streak": 0,
      "devotionals_completed": 0,
      "passages_completed": 0,
      "rank_position": null,
      "created_at": "2025-11-09T01:22:36.464926+00:00",
      "updated_at": "2025-11-09T01:22:36.464926+00:00"
    }
  },
  "message": "Perfil carregado com sucesso."
}
```

## POST /user-register

Registra um novo usuário no sistema.

### Autenticação

- Requer (`Authorization Bearer`)

### Corpo da Requisição

```json
{
  "name": "Nome do Usuário",
  "email": "email@exemplo.com",
  "password": "senha123"
}
```

### Resposta

```json
{
  "success": true,
  "message": "Usuário registrado com sucesso."
}
```

## POST /user-login

Autentica um usuário existente.

### Autenticação

- Requer (`Authorization Bearer`)

### Corpo da Requisição

```json
{
  "email": "email@exemplo.com",
  "password": "senha123",
  "device_token": "token-do-dispositivo"
}
```

### Resposta

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsImtpZCI6IllrUVoyZi8zZVVFazh2ZHoiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3BkYndkbnZhanF4YnViamVtdnVzLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIyZWY2OTZmMi0yOWYxLTQ4NjQtYjlkZS1mMjI2YjFhMTJhOTUiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYzOTM3NDM3LCJpYXQiOjE3NjMzMzI2MzcsImVtYWlsIjoiam9hby5zaWx2YUBleGFtcGxlLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzYzMzMyNjM3fV0sInNlc3Npb25faWQiOiJhZDRjNTA4My02MjlhLTQwNGMtOTQ2Zi1jMWJiOWRlNjQ3ZjUiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.J0aeUUhlaWsUZna0_Pv5Cb8nbpUtXc838rK0H2wPw6Q",
    "refresh_token": "hf3ywpjfxkzo"
  },
  "message": "Login realizado com sucesso."
}
```

## PUT /user-profile-update

Atualiza os dados do perfil do usuário.

### Autenticação

- Requer token JWT (via header `x-user-token` e `Authorization Bearer`)

### Corpo da Requisição

```json
{
  "name": "Novo Nome"
}
```

### Resposta

```json
{
  "success": true,
  "data": {
    "id": "2ef696f2-29f1-4864-b9de-f226b1a12a95",
    "name": "Jonathan Barreto",
    "email": "joao.silva@example.com",
    "created_at": "2025-10-24T02:47:09.280018+00:00",
    "updated_at": "2025-11-16T22:45:23.119+00:00"
  },
  "message": "Nome atualizado com sucesso."
}
```

## PUT /user-email-update

Atualiza o email do usuário.

### Autenticação

- Requer token JWT (via header `x-user-token` e `Authorization Bearer`)

### Corpo da Requisição

```json
{
  "email": "novo-email@exemplo.com",
  "password": "senha-atual-para-confirmacao"
}
```

### Resposta

```json
{
  "success": true,
  "data": {
    "id": "2ef696f2-29f1-4864-b9de-f226b1a12a95",
    "name": "Jonathan Barreto",
    "email": "jonathan.barreto@snowmanlabs.com",
    "created_at": "2025-10-24T02:47:09.280018+00:00",
    "updated_at": "2025-11-16T22:47:09.217+00:00"
  },
  "message": "Email atualizado com sucesso. Por favor, verifique seu novo email."
}
```

## PUT /user-password-update

Atualiza a senha do usuário.

### Autenticação

- Requer token JWT (via header `x-user-token` e `Authorization Bearer`)

### Corpo da Requisição

```json
{
  "current_password": "senha-atual",
  "new_password": "nova-senha"
}
```

### Resposta

```json
{
  "success": true,
  "message": "Senha atualizada com sucesso."
}
```

## DELETE /user-delete

Remove a conta do usuário.

### Autenticação

- Requer token JWT (via header `x-user-token` e `Authorization Bearer`)

### Corpo da Requisição

```json
{
  "password": "senha-para-confirmacao"
}
```

### Resposta

```json
{
  "success": true,
  "message": "Conta removida com sucesso."
}
```
