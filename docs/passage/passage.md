# Endpoints de Passagem Bíblica

Esta documentação descreve os endpoints relacionados às passagens bíblicas diárias.

## POST /passage-like

Permite que um usuário curta ou descurta uma passagem bíblica.

### Autenticação

- Requer token JWT (via header `x-user-token` ou `Authorization Bearer`)

### Corpo da Requisição

```json
{
  "passage_id": 123
}
```

### Parâmetros

- `passage_id` (obrigatório): ID da passagem bíblica

### Resposta

```json
{
  "success": true,
  "data": {
    "passage_id": 123,
    "liked": true,
    "action": "liked"
  },
  "message": "Like added successfully."
}
```

### Detalhes

- Se o usuário já tiver curtido a passagem, a ação será remover a curtida (unlike)
- Se o usuário não tiver curtido a passagem, a ação será adicionar a curtida (like)
- O campo `action` na resposta indica qual ação foi realizada: "liked" ou "unliked"
- O campo `liked` na resposta indica o estado atual: `true` se curtido, `false` se não curtido

## GET /passage-liked

Retorna todas as passagens bíblicas curtidas pelo usuário com paginação.

### Autenticação

- Requer token JWT (via header `x-user-token` ou `Authorization Bearer`)

### Parâmetros de Query

- `page` (opcional): Número da página para paginação. Padrão: 1

### Resposta

```json
{
  "success": true,
  "data": {
    "passages": [
      {
        "id": 123,
        "verse_reference": "Livro Capítulo:Versículos",
        "verse_text": "Texto dos versículos",
        "reading_time_estimate": 1,
        "created_at": "2023-01-01T00:00:00Z",
        "updated_at": "2023-01-01T00:00:00Z",
        "liked": true
      }
      // ... outras passagens
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
  "message": "User liked passages retrieved successfully."
}
```

### Detalhes

- As passagens são retornadas em ordem decrescente de data de criação (mais recentes primeiro)
- Cada passagem inclui uma flag `liked` que sempre será `true` neste endpoint
- A paginação é feita com 20 itens por página
