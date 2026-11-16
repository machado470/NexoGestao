# Campo telefônico de clientes — 12/11/2026

**AU13 — corrigido nos atributos dos formulários.** Cadastro e edição de clientes agora usam `type="tel"` e `inputMode="tel"`. A sugestão de teclado telefônico fica disponível aos navegadores que a suportam, preservando rótulos, números internacionais, formatação digitada e normalização existente no servidor.

Base `49ee4096`, PR #1044 integrado, branch `fix/clientes-teclado-telefone`. Workspace limpo ao iniciar. Os três checks do PR #1044 foram conferidos e passaram. PNPM 10.30.3 e os componentes Input existentes foram preservados. Nenhuma alteração de API, schema, permissão, validação de números ou hospedagem.

## Arquivos

- `apps/web/client/src/components/CreateCustomerModal.tsx`: atributos do campo `customer-phone`.
- `apps/web/client/src/components/EditCustomerModal.tsx`: mesmos atributos em `edit-customer-phone`, mantendo consistência entre cadastro e edição.

São duas mudanças de atributos. Não foram acrescentados testes que apenas repetissem o JSX; foram reaproveitados a suíte web existente e um fluxo operacional no navegador.

## Verificações

| Verificação | Resultado |
| --- | --- |
| `npx --yes pnpm@10.30.3 --filter @nexogestao/web test` | **802 testes passaram**, 100 arquivos. |
| `npx --yes pnpm@10.30.3 --filter @nexogestao/web typecheck` | Passou. |
| `npx --yes pnpm@10.30.3 --filter @nexogestao/web build` | Passou. |
| `npx --yes pnpm@10.30.3 --filter @nexogestao/web lint:os` | Passou no validador existente. |
| Chromium + BFF + API + PostgreSQL locais | Passou: login normal em conta fictícia; atributos DOM e rótulos nos dois modais em 1440×1000 e 390×844; número com `+`, espaços e parênteses aceito; cadastro e edição persistidos após recarga. Nenhum pageerror. |

O cadastro recebeu `+55 (47) 99999-9999` e persistiu `5547999999999`. A edição recebeu `+55 (47) 98888-7777` e persistiu `5547988887777`. O editor foi aberto pela ação existente no menu da carteira desktop e então reduzido para a largura mobile. A normalização em dígitos foi conferida no banco após cada operação. Dados e conta sintéticos próprios foram removidos, serviços encerrados e volumes preservados.

Evidências: [resultado do navegador](phone-fix-evidence/browser-result.json), [cadastro mobile](phone-fix-evidence/create-mobile.png), [edição mobile](phone-fix-evidence/edit-mobile.png), [testes](phone-fix-evidence/tests.txt), [tipos](phone-fix-evidence/typecheck.txt), [build](phone-fix-evidence/build.txt), [lint](phone-fix-evidence/lint.txt).

## Limites e pendências

A emulação Chromium comprova os atributos e o comportamento do formulário, não a abertura física do teclado nativo. A verificação em iOS/Android reais continua pendente. A suíte API completa não foi repetida nesta mudança de atributos; a persistência dos números foi exercitada pela API real no fluxo descrito.

Restam três achados originais de escopo mais amplo: AU08 (motor genérico de automações), AU11 (ciclo de privacidade) e AU12 (recuperação operacional). Testes de carga, sandbox externo e limitações já registradas nas etapas anteriores permanecem separados dessas correções.
