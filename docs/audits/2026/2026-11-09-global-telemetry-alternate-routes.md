# Rotas alternativas de telemetria global — 2026-11-09

Base: main `9a97073574355e9788e538e27169f450e7bf444c`.

## Falhas identificadas

`GET /queue/status` não tinha guard de autenticação e consultava QueueService.getQueueStatus, que agrega filas de toda a plataforma. O TenantAccessGuard global permite requisições sem req.user e não substitui autenticação nessa rota.

`GET /internal/metrics` exigia ADMIN de organização, mas retornava o exportador de métricas globais, sem filtro de tenant. Isso contornava a política já aplicada em `/internal/operations/*`, que recusa telemetria global para usuários de organização porque não existe autoridade de operador da plataforma no modelo de identidade atual.

## Correção

As duas rotas exigem JWT válido, estado ativo e papel administrativo. Após esses guards, recusam a telemetria global com 403, inclusive para ADMIN de organização. Visitantes e tokens inválidos recebem 401. Não há leitura de Redis nem chamada ao exportador para responder a essas solicitações.

Não foi criado papel de operador nem flag para contornar o bloqueio. Serviços internos de observabilidade e exportação permanecem disponíveis no código; o bloqueio é nas duas superfícies HTTP de usuários de organização. Rotas de diagnóstico e sinais já filtradas por tenant, bem como os health checks existentes, não foram alteradas.

## Verificação

- API: 155 suítes e 960 testes aprovados.
- Nova suíte HTTP: 12 casos com JWTs assinados e JwtStrategy, ActiveUserGuard e RolesGuard reais. Somente o repositório de usuários e as fontes de telemetria são simulados.
- Cobertura: visitante, assinatura inválida, seis papéis em duas organizações, tentativa de alterar orgId por query/header, usuário inativo e sessionVersion revogado.
- Spies comprovam que getQueueStatus e exportJson não são chamados nos cenários bloqueados.
- Respostas não contêm métricas, identificadores das organizações simuladas ou URLs de infraestrutura.
- Typecheck da API, build dos três workspaces, validador operacional web e git diff --check aprovados.

Não houve migration, acesso a produção ou alteração de hospedagem. Clientes antigos que usavam essas rotas para ler métricas globais deixam de receber os dados; uma superfície futura para operadores exigirá autoridade explícita, conforme a política já existente. Esta alteração não constitui uma auditoria de todos os endpoints ou portas de observabilidade.
