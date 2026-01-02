# Endpoints de Devocional

Esta documentação descreve os endpoints relacionados ao registro de conclusão de devocionais.

## POST /devotional-completion

Registra a conclusão de um devocional (público ou privado) por um usuário.

### Autenticação

- Requer token JWT (via header `x-user-token` ou `Authorization Bearer`)

### Corpo da Requisição

```json
{
  "devotional_id": 123,
  "type": "public",
  "completed_at": "2023-01-01T12:00:00Z"
}
```

### Parâmetros

- `devotional_id` (obrigatório): ID do devocional concluído
- `type` (obrigatório): Tipo do devocional ("public" ou "private")
- `completed_at` (opcional): Data e hora da conclusão no formato ISO. Se não fornecido, será usado o horário atual.

### Resposta

```json
{
  "success": true,
  "message": "Devotional completion recorded successfully."
}
```

### Detalhes

- O endpoint verifica se o devocional existe antes de registrar a conclusão
- Se o usuário já tiver concluído o devocional, retorna uma mensagem informando que já foi concluído
- A conclusão do devocional é registrada na tabela `devotional_completions`
