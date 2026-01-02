# Endpoint de Dashboard

Esta documentação descreve o endpoint de dashboard que fornece dados consolidados para a tela inicial do aplicativo.

## GET /dashboard

Retorna os dados consolidados para a tela inicial do aplicativo, incluindo o devocional público do dia, a passagem do dia, o calendário semanal de devocionais e o último devocional privado do usuário.

### Autenticação

- Requer token JWT (via header `x-user-token` ou `Authorization Bearer`)

### Resposta

```json
{
  "success": true,
  "data": {
    "public_devotional": null,
    "passage": null,
    "calendar": [
      {
        "day": "domingo",
        "date": "2025-11-16",
        "completed": false,
        "isToday": false
      },
      {
        "day": "segunda",
        "date": "2025-11-17",
        "completed": false,
        "isToday": true
      },
      {
        "day": "terça",
        "date": "2025-11-18",
        "completed": false,
        "isToday": false
      },
      {
        "day": "quarta",
        "date": "2025-11-19",
        "completed": false,
        "isToday": false
      },
      {
        "day": "quinta",
        "date": "2025-11-20",
        "completed": false,
        "isToday": false
      },
      {
        "day": "sexta",
        "date": "2025-11-21",
        "completed": false,
        "isToday": false
      },
      {
        "day": "sábado",
        "date": "2025-11-22",
        "completed": false,
        "isToday": false
      }
    ],
    "private_devotional": {
      "id": 17,
      "user_id": "2ef696f2-29f1-4864-b9de-f226b1a12a95",
      "title": "A Força Revelada na Fragilidade da Fé",
      "verse_reference": "2 Coríntios 12:9-10",
      "verse_text": "Mas ele me disse: 'A minha graça é suficiente para você, porque o meu poder se aperfeiçoa na fraqueza.' Portanto, de bom grado me gloriarei nas minhas fraquezas, para que o poder de Cristo repouse sobre mim. Por isso, sinto prazer nas fraquezas, nos insultos, nas necessidades, nas perseguições, nas angústias, por causa de Cristo. Porque, quando sou fraco, então é que sou forte.",
      "reflection": "A sensação de fraqueza na fé é uma experiência que ressoa profundamente na alma humana, muitas vezes confundida com falha ou deficiência espiritual. No entanto, a Escritura nos oferece uma perspectiva contrária: é precisamente nesse ponto de esgotamento que a graça divina se manifesta com maior clareza. O apóstolo Paulo, em 2 Coríntios 12:9-10, articulou essa verdade de forma pungente, revelando que a força de Cristo se aperfeiçoa na fraqueza humana.\n\nConsideremos Gideão, um homem que se via como o menor em sua família e seu clã (Juízes 6:15). Sua fé vacilava diante da magnitude da tarefa e da percepção de sua própria insignificância. Ele pediu sinais, demonstrando uma fé ainda em formação, um desejo honesto de confirmação divina em meio à sua hesitação. Sua história não é de um herói que nunca duvidou, mas de alguém que, apesar de sua fraqueza inicial e repetidos pedidos por garantia, foi usado poderosamente por Deus.\n\nOu pensemos em Elias, o profeta que desafiou centenas de profetas de Baal no Monte Carmelo. Após um triunfo espetacular que demonstrou o poder inquestionável de Deus, ele se viu fugindo e desejando a morte sob um zimbro (1 Reis 19). A intensidade de sua fé e coragem foi seguida por um abismo de desespero. Essa oscilação revela que a fé não é uma linha reta ascendente, mas uma jornada marcada por vales e picos, onde a vulnerabilidade humana se encontra com a perseverança divina.\n\nMesmo Marta, que professou sua fé em Cristo como o Messias (João 11:27), expressou frustração e uma certa incredulidade quando Lázaro morreu: 'Senhor, se estivesses aqui, meu irmão não teria morrido' (João 11:21). Sua fé, embora real, era desafiada pela dor e pela aparente inatividade de Jesus. Contudo, foi através dessa aparente fraqueza e questionamento que Jesus revelou a glória de Deus e a si mesmo como a ressurreição e a vida.\n\nA fraqueza na fé, portanto, não é um sinal de que Deus nos abandonou, mas, muitas vezes, um convite para que o controle e a autossuficiência sejam entregues. É um momento em que a graça, em vez de ser um conceito abstrato, torna-se a experiência visceral da dependência total. A fé não é a ausência de dúvidas ou de um sentimento de incapacidade, mas a escolha deliberada de repousar na fidelidade dAquele que é forte, mesmo quando nos sentimos mais fracos. É a compreensão de que nossa força não reside em nossa capacidade de crer sem falhas, mas na capacidade de Cristo de nos sustentar através de nossas falhas.",
      "application": "Quando a fraqueza na fé se manifestar, considere estas perspectivas:\n\n*   **Reavalie a fonte de sua força:** Em vez de buscar força em sua própria capacidade de crer, direcione-se à suficiência da graça de Cristo. A fé não é um músculo que você precisa exercitar até a exaustão, mas um canal para a força divina.\n*   **Abrace a vulnerabilidade:** Reconhecer a fraqueza não é um passo para trás, mas um movimento em direção à dependência genuína de Deus. É na entrega que o poder de Cristo pode repousar sobre você.\n*   **Lembre-se da fidelidade passada:** Olhe para as histórias de Gideão, Elias e Marta, e para sua própria vida, para testemunhos de como Deus agiu poderosamente apesar das falhas e dúvidas humanas. Sua fidelidade não diminuiu.\n*   **Permita que a graça seja suficiente:** Não se esforce para 'sentir' mais fé, mas descanse na promessa de que a graça de Deus é suficiente para cada momento de escassez, sustentando-o além de seus próprios sentimentos.",
      "prayer": "Deus de toda graça, em momentos de fraqueza, quando a fé parece diminuir, recorda-nos que Teu poder se aperfeiçoa em nossa fragilidade. Ajuda-nos a não temer a vulnerabilidade, mas a abraçá-la como um convite à dependência total de Ti. Que a suficiência da Tua graça nos sustente e nos impulsione, para que, mesmo fracos, possamos encontrar em Ti a verdadeira força. Amém.",
      "reading_time_estimate": 5,
      "evaluation_note": null,
      "created_at": "2025-11-11T19:40:41.537+00:00",
      "updated_at": "2025-11-11T19:44:59.954+00:00",
      "description": "Uma meditação sobre a experiência da fraqueza na fé, explorando como Deus se manifesta e aperfeiçoa Sua força precisamente em nossas vulnerabilidades, através de exemplos bíblicos menos óbvios.",
      "feeling": "Me sentindo fraco na fé",
      "processing": false
    }
  },
  "message": "Dashboard data retrieved successfully."
}
```

### Detalhes

- O campo `public_devotional` contém o devocional público do dia atual, com uma flag `liked` indicando se o usuário curtiu o devocional.
- O campo `passage` contém a passagem bíblica do dia atual, com uma flag `liked` indicando se o usuário curtiu a passagem. Note que a passagem não possui os campos title e reflection.
- O campo `calendar` contém um array com os dias da semana atual, indicando quais dias o usuário completou devocionais.
- O campo `private_devotional` contém o último devocional privado criado pelo usuário.
