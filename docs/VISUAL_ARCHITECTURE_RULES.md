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

## Regras adicionais — páginas internas (2026-04-11)

1. Não usar componentes de catálogo diretamente nas páginas internas sem passar pela camada `app-system`.
2. Não copiar bloco do Flowbite diretamente para produção; usar apenas benchmark de composição.
3. Toda página interna deve partir de `AppPageShell` + `AppPageHeader`.
4. Todo modal interno novo deve usar `BaseModal`/`FormModal`/`ConfirmModal`.
5. Tabelas internas devem usar `AppDataTable`; badges de status devem usar `AppStatusBadge`.
6. Dropdown de ação por linha deve usar `AppRowActionsDropdown` ou `AppDropdown`.
7. Evitar hardcodes proibidos: `bg-zinc-900`, `bg-slate-900`, `bg-black` (incluindo variantes `dark:*`).
8. Componentes novos do app devem usar tokens do contexto operacional (`var(--text-*)`, `var(--border-*)`, `var(--surface-*)`, etc.).
