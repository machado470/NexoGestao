# Regras de Arquitetura Visual (Public/Auth/App)

## Objetivo
Garantir isolamento visual estrutural entre páginas públicas, autenticação e sistema autenticado.

## Namespaces obrigatórios
- `.nexo-public`: landing/marketing e fluxos públicos.
- `.nexo-auth`: login, cadastro, recuperação, reset, convite.
- `.nexo-app`: área autenticada operacional.

## Regras de composição
1. Páginas públicas **não** devem usar superfícies operacionais sem variante explícita.
2. Páginas de autenticação **não** devem usar `AppCard`/tokens operacionais.
3. O app autenticado usa tokens/surfaces escopados em `.nexo-app`.
4. Componentes compartilhados devem expor variante explícita por contexto.
5. Evitar CSS global genérico sem namespace (`.card`, `.dialog`, `.surface`, `.page-shell`).

## Cards por contexto
- `AppCard`: somente sistema interno.
- `PublicCard`: landing/marketing.
- `AuthCard`: login/cadastro/recuperação/reset/convite.

## Dark mode
- Regras dark do app devem ser escopadas ao contexto `.nexo-app`.
- Páginas `.nexo-public` e `.nexo-auth` devem manter superfícies próprias e legíveis sem herança cega do app.
