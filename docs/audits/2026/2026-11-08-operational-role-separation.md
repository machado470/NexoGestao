# Separação de papéis nas telas operacionais — 2026-11-08

## Diagnóstico e correção

`RolesGuard` normalizava MANAGER e STAFF para OPERADOR antes de comparar as permissões. Isso fazia STAFF passar em rotas declaradas apenas para ADMIN/MANAGER, incluindo leitura financeira e geração manual de cobrança. A comparação dos papéis canônicos agora respeita os papéis explicitamente declarados em cada rota. ADMIN mantém seu comportamento existente. Os aliases antigos de metadados de leitura OPERADOR/FINANCEIRO continuam compatíveis; não são usados para agrupar MANAGER e STAFF nas rotas canônicas.

O frontend foi alinhado às declarações da API: Financeiro fica disponível para ADMIN/MANAGER. STAFF mantém leitura e alterações operacionais autorizadas em Clientes, Agenda e O.S., sem geração manual de cobrança. VIEWER mantém consulta dessas áreas, com criação/edição/confirmação/execução desabilitadas. A API continua impondo a autorização independentemente dos controles da interface.

Clientes, Agenda e O.S. consultam responsáveis em `/people/assignees`, já autorizado para os quatro papéis, em vez da lista administrativa `/people`. O modal compartilhado de criação de agendamento usa a mesma rota e só consulta quando aberto. Calendário restringe a criação para VIEWER e não consulta o resumo administrativo da equipe para perfis sem permissão; a grade de agendamentos permanece disponível.

Links de remarcação não abrem o editor para VIEWER. Links para O.S. vinculada a agendamento continuam permitindo consultar uma O.S. existente, sem abrir criação para quem não pode criar. Os formulários também respeitam o papel ao serem renderizados, evitando manter um editor disponível após atualização do acesso no contexto da aplicação.

| Perfil | Clientes, Agenda e O.S. | Financeiro |
| --- | --- | --- |
| ADMIN | Leitura e alterações declaradas nas rotas | Leitura e alterações |
| MANAGER | Leitura e alterações declaradas nas rotas | Leitura e alterações |
| STAFF | Leitura e alterações operacionais permitidas | Sem acesso à página/rotas financeiras |
| VIEWER | Somente leitura | Sem acesso à página/rotas financeiras |

O escopo financeiro desta tabela corresponde às rotas Financeiro; resumos factuais retornados por outros endpoints continuam sujeitos à política desses endpoints. Não houve alteração de integrações externas, schema ou migrations.

## Validação

Os testes HTTP usam os controllers e o RolesGuard reais, com autenticação e serviços de domínio substituídos por doubles, para verificar que STAFF/VIEWER são bloqueados antes da execução de lógica financeira. Também verificam leitura de O.S. para os quatro papéis e edição de O.S. permitida a STAFF, mas recusada a VIEWER. Testes de matriz verificam separação canônica e compatibilidade dos aliases de leitura.

A suíte API completa passou com 716 testes aprovados; a suíte web completa passou com 612 testes. Após os ajustes finais do modal/calendário, as regressões específicas também passaram (61 testes de telas/atribuição/permissões e 9 de calendário). Build dos três pacotes, rebuild final do cliente, checagens de tipos e lint operacional foram executados.

## Conferência no navegador

Chromium/Playwright foi executado com API, BFF e banco locais reais, em quatro sessões separadas com usuários ADMIN, MANAGER, STAFF e VIEWER. Todos passaram. VIEWER consultou cliente/agendamento/O.S., teve criação/confirmação/execução bloqueadas e não abriu remarcação por link; também teve criação bloqueada no Calendário e a página Financeiro recusada. STAFF consultou as mesmas áreas, pôde abrir o editor de remarcação e manteve criação operacional habilitada, com geração manual de cobrança e página Financeiro bloqueadas. MANAGER e ADMIN carregaram o Financeiro normalmente. Não foram detectadas exceções JavaScript no fluxo validado.

As tentativas iniciais de automação precisaram ajustar seletores para elementos duplicados de layouts responsivos e para o isolamento de acessibilidade de um modal já aberto; a rodada final passou nos quatro perfis. A verificação não enviou mensagens ou executou provedores externos.

Os processos de teste e o projeto Compose descartável foram encerrados após a validação.
