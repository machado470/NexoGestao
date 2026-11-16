# Rótulos acessíveis dos formulários operacionais — 12/11/2026

Base `6515cf18`, branch `fix/formularios-rotulos-acessiveis`, raiz `/workspace/NexoGestao`, início limpo; sem AGENTS.md aplicável. README/manifests, formulários e AppField/AppSelect consultados. PR #1060 integrado; Compose e um quality-gate aprovados, outro ainda em execução na última consulta.

## Achado confirmado

O modal de agendamento tinha labels visuais sem htmlFor e controles sem id. O navegador confirmou controles sem nome associado, prejudicando a identificação assistiva e o foco pelo rótulo. O mesmo padrão estava no modal compartilhado de agendamento do Calendário/Clientes e na criação de O.S. [DOM antes](form-labels-evidence/before.json), [ensaio inicial](form-labels-evidence/before.txt).

## Correção

- `apps/web/client/src/pages/AppointmentsPage.tsx`: associação dos sete campos do modal de criação/edição.
- `apps/web/client/src/components/CreateAppointmentModal.tsx`: associação dos sete campos do modal usado pelo Calendário/Clientes.
- `apps/web/client/src/components/CreateServiceOrderModal.tsx`: associação de cliente, responsável, serviço, detalhes, data prevista, valor e vencimento, inclusive seletor aninhado no bloco do responsável.
- `apps/web/client/src/components/app-system.tsx`: AppSelect aceita id opcional e o encaminha ao SelectTrigger. Consumidores existentes continuam válidos.

Cada formulário usa useId do React para prefixo único por instância, com htmlFor/id correspondentes. Não foram alterados handlers, tipos de campo, valores, permissões, datas, contratos ou aparência. Não houve extração genérica que presumisse a estrutura de todos os AppField do produto.

## Verificação

- **806 testes web / 100 arquivos passaram.** [Log](form-labels-evidence/tests.txt).
- `pnpm --filter ./apps/web typecheck`, `lint:os` e `build` passaram. [Tipos](form-labels-evidence/types.txt), [lint](form-labels-evidence/lint.txt), [build](form-labels-evidence/build.txt). PNPM via `npx --yes pnpm@10.30.3`.
- Chromium real, login e API/BFF/PostgreSQL locais: seis verificações (Agendamentos, Calendário e O.S., cada um em 1440/390 px) confirmaram controles visíveis com rótulos associados e IDs presentes/únicos, foco pelo rótulo e avanço Tab, sem overflow horizontal da página. [DOM e resultado](form-labels-evidence/browser.json), [execução](form-labels-evidence/browser.txt).
- Capturas em 390 px: [Agendamentos](form-labels-evidence/appointments-390.png), [Calendário](form-labels-evidence/calendar-390.png), [O.S.](form-labels-evidence/service-orders-390.png).
- `git diff --check`: passou. A formatação das props foi normalizada após o primeiro teste; não mudou comportamento. Não se repetiram testes API porque seus fontes não mudaram.

A harness foi ajustada para usar o nome visível correto do botão Nova O.S. e permitir os segmentos nativos de data durante Tab; esses ajustes não representam falhas do produto. A execução final passou. Campos recolhidos no accordion Avançado foram conferidos por código; o DOM capturado inclui apenas controles visíveis na abertura.

## Dados e limites

Organização, ADMIN verificado, pessoa e cliente fictícios criados como fixtures; nenhum cliente/agendamento/O.S. operacional foi submetido nesta rodada. Foram abertas e canceladas as janelas, sem operação externa. Fixtures próprias e relações removidas ao terminar; serviços/containers locais encerrados, volumes preservados. A harness temporária com credenciais de teste não foi versionada.

Esta etapa cobre associação de labels e navegação amostrada, não uma certificação WCAG, teste completo de leitor de tela ou teclado virtual iOS/Android. O fluxo de gravação completo foi comprovado na rodada anterior; esta mudança preserva seus handlers. AU08/AU11/AU12 continuam parciais pelas pendências já registradas.
