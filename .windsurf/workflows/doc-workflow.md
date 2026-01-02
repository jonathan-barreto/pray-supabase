---
description: Esse workflow garante que toda alteração no código seja acompanhada pela atualização da documentação, mantendo-a completa, clara e sincronizada com o projeto.
auto_execution_mode: 3
---

# Workflow de Atualização de Documentação

## Objetivo
Este documento estabelece o processo obrigatório para manter a documentação do projeto Academia Foguete sempre atualizada e sincronizada com o código-fonte. A documentação precisa e completa é essencial para garantir que todos os membros da equipe possam entender, manter e expandir o projeto de forma eficiente.

## Regra Fundamental
**Toda alteração no código DEVE ser acompanhada por uma atualização correspondente na documentação.**

## Processo Passo a Passo

### 1. Antes de Iniciar Qualquer Alteração
- Identifique quais documentos podem ser afetados pela alteração planejada
- Revise a documentação existente para entender o contexto atual
- Planeje as atualizações de documentação necessárias junto com as alterações de código

### 2. Durante o Desenvolvimento
- Mantenha anotações sobre as alterações que está fazendo
- Documente novos métodos, funções, tabelas ou endpoints à medida que são criados
- Atualize comentários no código conforme necessário

### 3. Antes de Submeter Alterações (Commit/PR)
- **Varredura Completa**: Revise todas as alterações feitas e identifique todos os arquivos de documentação que precisam ser atualizados
- Verifique especificamente:
  - `/docs/database/README.md` para alterações em tabelas, esquemas ou funções SQL
  - `/docs/endpoints/README.md` para alterações em Edge Functions e endpoints da API
  - `/docs/triggers/README.md` para alterações em triggers do banco de dados
  - `/docs/functions/*.js` para alterações em funções específicas
  - `/docs/alert/security_performance.md` para alterações que afetam segurança ou desempenho
  - `/docs/README.md` para alterações que afetam a visão geral do projeto

### 4. Checklist de Verificação
- [ ] Todas as novas funcionalidades estão documentadas?
- [ ] Todas as alterações em funcionalidades existentes estão refletidas na documentação?
- [ ] Todas as remoções de funcionalidades foram anotadas na documentação?
- [ ] Os exemplos na documentação ainda são válidos após as alterações?
- [ ] As políticas de segurança (RLS) estão documentadas?
- [ ] As alterações de esquema do banco de dados estão documentadas?
- [ ] As dependências entre componentes estão claramente documentadas?

### 5. Revisão da Documentação
- Peça a um colega para revisar as alterações na documentação
- Verifique se a documentação está clara e compreensível para alguém não familiarizado com as alterações
- Confirme que a documentação segue o padrão e formato estabelecidos

### 6. Manutenção Contínua
- Realize revisões periódicas da documentação (pelo menos mensalmente)
- Identifique e corrija discrepâncias entre o código e a documentação
- Atualize a documentação quando descobrir informações desatualizadas, mesmo que não esteja fazendo alterações no código

## Responsabilidades
- Cada desenvolvedor é responsável por manter a documentação atualizada para as alterações que fizer
- Os revisores de código devem verificar se a documentação foi atualizada adequadamente
- O líder técnico deve garantir que este workflow seja seguido por toda a equipe

## Lembre-se
- Documentação não é uma tarefa adicional, é parte integral do desenvolvimento
- Código sem documentação adequada é considerado incompleto
- A documentação deve ser tratada com o mesmo nível de importância que o código-fonte

## Consequências de Não Seguir o Workflow
- Pull requests sem atualizações de documentação serão rejeitados
- Código sem documentação adequada não deve ser implantado em produção
- Problemas causados por documentação desatualizada serão atribuídos ao responsável pela última alteração

---

**A documentação é um investimento no futuro do projeto e na eficiência da equipe.**