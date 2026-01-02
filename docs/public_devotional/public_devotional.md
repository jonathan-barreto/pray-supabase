# Endpoints de Devocionais Públicos

Esta documentação descreve os endpoints relacionados aos devocionais públicos.

## POST /public-devotional-like

Permite que um usuário curta ou descurta um devocional público.

### Autenticação

- Requer token JWT (via header `x-user-token` ou `Authorization Bearer`)

### Corpo da Requisição

```json
{
  "public_devotional_id": 123
}
```

### Parâmetros

- `public_devotional_id` (obrigatório): ID do devocional público

### Resposta

```json
{
  "success": true,
  "message": "Like added successfully.",
  "data": {
    "public_devotional_id": 123,
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

## GET /public-devotional-liked?page=1

Retorna todos os devocionais públicos curtidos pelo usuário com paginação.

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
        "title": "Título do Devocional",
        "description": "Descrição do devocional",
        "verse_reference": "Livro Capítulo:Versículos",
        "verse_text": "Texto dos versículos",
        "reflection": "Reflexão do devocional",
        "application": "Aplicação prática",
        "prayer": "Oração sugerida",
        "reading_time_estimate": 5,
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
  "message": "Liked devotionals retrieved successfully."
}
```

### Detalhes

- Os devocionais são retornados em ordem decrescente de data de criação (mais recentes primeiro)
- Cada devocional inclui uma flag `liked` que sempre será `true` neste endpoint
- A paginação é feita com 20 itens por página
