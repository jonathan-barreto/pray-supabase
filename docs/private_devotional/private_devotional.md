# Endpoints de Devocionais Privados

Esta documentação descreve os endpoints relacionados aos devocionais privados dos usuários.

## GET /private-devotionals?page=1

Retorna a lista de devocionais privados do usuário com paginação.

### Autenticação

- Requer token JWT (via header `x-user-token` ou `Authorization Bearer`)

### Parâmetros de Query

- `page` (opcional): Número da página para paginação. Padrão: 1

### Resposta

```json
{
  "success": true,
  "data": {
    "devotionals": [
      {
        "id": 123,
        "user_id": "uuid",
        "feeling": "Descrição do sentimento",
        "title": "Título do Devocional",
        "description": "Descrição do devocional",
        "verse_reference": "Livro Capítulo:Versículos",
        "verse_text": "Texto dos versículos",
        "reflection": "Reflexão personalizada",
        "application": "Aplicação prática",
        "prayer": "Oração personalizada",
        "reading_time_estimate": 5,
        "evaluation_note": null,
        "processing": false,
        "created_at": "2023-01-01T00:00:00Z",
        "updated_at": "2023-01-01T00:00:00Z",
        "liked": true
      }
      // ... outros devocionais
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_items": 100,
      "items_per_page": 20,
      "has_next_page": true,
      "has_previous_page": false
    }
  },
  "message": "User devotionals retrieved successfully."
}
```

### Detalhes

- Os devocionais são retornados em ordem decrescente de data de criação (mais recentes primeiro)
- Cada devocional inclui uma flag `liked` indicando se o usuário curtiu o devocional
- A paginação é feita com 20 itens por página

## GET /private-devotional/:id

Retorna um devocional privado específico pelo ID.

### Autenticação

- Requer token JWT (via header `x-user-token` ou `Authorization Bearer`)

### Parâmetros de URL

- `id`: ID do devocional privado

### Resposta

```json
{
  "success": true,
  "data": {
    "id": 123,
    "user_id": "uuid",
    "feeling": "Descrição do sentimento",
    "title": "Título do Devocional",
    "description": "Descrição do devocional",
    "verse_reference": "Livro Capítulo:Versículos",
    "verse_text": "Texto dos versículos",
    "reflection": "Reflexão personalizada",
    "application": "Aplicação prática",
    "prayer": "Oração personalizada",
    "reading_time_estimate": 5,
    "evaluation_note": null,
    "processing": false,
    "created_at": "2023-01-01T00:00:00Z",
    "updated_at": "2023-01-01T00:00:00Z",
    "liked": true
  },
  "message": "Devotional retrieved successfully."
}
```

### Detalhes

- O devocional inclui uma flag `liked` indicando se o usuário curtiu o devocional
- O endpoint verifica se o devocional pertence ao usuário autenticado

## POST /private-devotional-create

Salva rapidamente um sentimento do usuário na tabela de devocionais privados, sem esperar pela geração do devocional completo.

### Autenticação

- Requer token JWT (via header `x-user-token` ou `Authorization Bearer`)

### Corpo da Requisição

```json
{
  "feeling": "Estou me sentindo ansioso com meu trabalho"
}
```

### Resposta

```json
{
  "success": true,
  "data": {
    "id": 18,
    "user_id": "2ef696f2-29f1-4864-b9de-f226b1a12a95",
    "title": null,
    "verse_reference": null,
    "verse_text": null,
    "reflection": null,
    "application": null,
    "prayer": null,
    "reading_time_estimate": null,
    "evaluation_note": null,
    "created_at": "2025-11-17T01:10:17.032+00:00",
    "updated_at": "2025-11-17T01:10:17.032+00:00",
    "description": null,
    "feeling": "Me sentindo fraco na fé",
    "processing": false
  },
  "message": "Feeling saved successfully."
}
```

### Detalhes

- Este endpoint é útil para evitar perda de dados caso a conexão do usuário caia durante o processo de geração do devocional
- Apenas o campo `feeling` é salvo, deixando os outros campos vazios

## POST /private-devotional-like

Permite que um usuário curta ou descurta um devocional privado.

### Autenticação

- Requer token JWT (via header `x-user-token` ou `Authorization Bearer`)

### Corpo da Requisição

```json
{
  "private_devotional_id": 123
}
```

### Parâmetros

- `private_devotional_id` (obrigatório): ID do devocional privado

### Resposta

```json
{
  "success": true,
  "message": "Like added successfully.",
  "data": {
    "private_devotional_id": 123,
    "liked": true,
    "action": "liked"
  }
}
```

### Detalhes

- Se o usuário já tiver curtido o devocional, a ação será remover a curtida (unlike)
- Se o usuário não tiver curtido o devocional, a ação será adicionar a curtida (like)
- O campo `action` na resposta indica qual ação foi realizada: "liked" ou "unliked"
- O campo `liked` na resposta indica o estado atual: `true` se curtido, `false` se não curtido

## GET /private-devotional-liked?page=1

Retorna todos os devocionais privados curtidos pelo usuário com paginação.

### Autenticação

- Requer token JWT (via header `x-user-token` ou `Authorization Bearer`)

### Parâmetros de Query

- `page` (opcional): Número da página para paginação. Padrão: 1

### Resposta

```json
{
  "success": true,
  "data": {
    "devotionals": [
      {
        "id": 123,
        "user_id": "uuid",
        "feeling": "Descrição do sentimento",
        "title": "Título do Devocional",
        "description": "Descrição do devocional",
        "verse_reference": "Livro Capítulo:Versículos",
        "verse_text": "Texto dos versículos",
        "reflection": "Reflexão personalizada",
        "application": "Aplicação prática",
        "prayer": "Oração personalizada",
        "reading_time_estimate": 5,
        "evaluation_note": null,
        "processing": false,
        "created_at": "2023-01-01T00:00:00Z",
        "updated_at": "2023-01-01T00:00:00Z",
        "liked": true
      }
      // ... outros devocionais
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_items": 100,
      "items_per_page": 20,
      "has_next_page": true,
      "has_previous_page": false
    }
  },
  "message": "User liked devotionals retrieved successfully."
}
```

### Detalhes

- Os devocionais são retornados em ordem decrescente de data de criação (mais recentes primeiro)
- Cada devocional inclui uma flag `liked` que sempre será `true` neste endpoint
- A paginação é feita com 20 itens por página
