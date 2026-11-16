# Revogação de sessões com notificações abertas — 12/11/2026

## Resultado

**AU06 — corrigido.** O stream SSE passou a consultar a mesma identidade persistida validada no JWT HTTP antes de enviar cada quadro, incluindo replay e eventos aguardando escrita. Sem eventos, o heartbeat inicia essa verificação a cada 25 segundos. Sessão inválida ou erro na consulta encerra o stream e remove timers e registro no hub.

Base `af82dba0` (PR #1043 integrado), branch `fix/notificacoes-revogacao-sessao`, raiz `/workspace/NexoGestao`, PNPM 10.30.3. Workspace limpo ao começar; nenhum AGENTS.md aplicável. README/manifests e contratos de autenticação/notificações já consultados no trabalho corrente. Dados fictícios em PostgreSQL/Redis locais. Sem migration ou alteração de hospedagem.

O PR #1043 foi conferido: os três checks passaram antes desta etapa.

## Mudanças

- `apps/api/src/auth/persisted-session.ts`: validação compartilhada de conta ativa, pessoa ativa e presente, organização, papel, vínculo com pessoa e `sessionVersion`. Retorna a identidade persistida validada e a versão da sessão.
- `apps/api/src/auth/jwt.strategy.ts`: usa essa função após a verificação de assinatura/expiração pelo Passport. O contexto interno autenticado conserva `sessionVersion`, necessário para comparar uma conexão já aberta com a sessão original.
- `apps/api/src/notifications/notifications.controller.ts`: captura os claims autenticados da abertura, revalida antes de cada escrita, monitora expiração desde o início do replay, verifica sessões ociosas no heartbeat e encerra com limpeza em falha de replay/consulta. Um papel ou versão novo não é adotado por uma conexão antiga. A fila do hub e o envelope SSE existentes foram preservados.
- `apps/api/src/auth/jwt.strategy.spec.ts`: contrato da identidade interna atualizado para incluir a versão.
- `apps/api/src/notifications/notifications-stream-session.spec.ts`: 16 cenários de revogação, expiração, disponibilidade, heartbeat, replay, ordenação/deduplicação e backpressure.
- `apps/api/test/integration/notification-session-postgres.integration.spec.ts`: sete cenários com JWT real, HTTP SSE aberto e PostgreSQL: mudança de versão/papel, conta/pessoa desativada, pessoa removida, conexão ociosa e reset de senha. Verifica token antigo recusado, outro tenant preservado e novo token funcionando.

## Verificação

| Verificação | Resultado |
| --- | --- |
| `npx --yes pnpm@10.30.3 test` | **2.080 testes aprovados**: API 1.274 executados; web 802 e common 4 reaproveitados do cache válido do Turbo. API ignora 152 cenários condicionais nesta execução padrão. |
| Suíte ampliada `RUN_REAL_INTEGRATION=true ... jest --runInBand test/integration/ --testPathIgnorePatterns phase23c-` | **137 passaram**, 26 suítes; 33 ignorados por guards/escopo. Inclui os sete cenários novos e as regressões anteriores de persistência, isolamento, assinatura e financeiro. |
| Suíte dedicada comercial no banco `nexo_commercial_test` | **13 passaram**, confirmando restrições e regularização com a autenticação atualizada. São 150 execuções de integração somadas às duas suítes, sem contar como casos todos distintos dos testes gerais. |
| Foco em JWT/segurança HTTP/notificações | **83 passaram**, incluindo os 16 testes novos do stream. |
| `npx --yes pnpm@10.30.3 build` | Passou: API recompilada, web/common com cache válido. |
| `npx --yes pnpm@10.30.3 -r typecheck` | Passou. |
| `npx --yes pnpm@10.30.3 --filter @nexogestao/web lint:os` | Passou no validador existente. Wrapper agregado não repetido nesta etapa; falha de download do PNPM já documentada anteriormente. |
| Chromium + BFF + API + Redis + PostgreSQL | Passou: login normal em conta fictícia; EventSource pelo BFF recebeu um envelope; incremento da versão no banco fechou o stream, impediu o próximo evento e fez a reconexão retornar 401. Nenhum pageerror. |

Evidências: [testes gerais](stream-fix-evidence/all-tests.txt), [integração](stream-fix-evidence/integration.txt), [regressão comercial](stream-fix-evidence/commercial-regression.txt), [testes focados](stream-fix-evidence/focused.txt), [build](stream-fix-evidence/build.txt), [tipos](stream-fix-evidence/typecheck.txt), [lint](stream-fix-evidence/lint.txt), [resultado do navegador](stream-fix-evidence/browser-result.json).

O cenário de reset de senha chama o endpoint público com um token fictício cuja hash/validade foi inserida somente na conta de teste. A primeira versão dessa fixture usava `newPassword`, enquanto o contrato exige `password`; o teste foi ajustado ao DTO real e passou. O produto não foi alterado para acomodar esse erro de fixture.

O navegador usa uma conta fictícia e envelopes sintéticos publicados no Redis real para testar a cadeia de transporte. O fluxo de reset completo é provado pela integração HTTP separada. Não há envio a provedor de e-mail/WhatsApp externo. Registros próprios foram removidos e os serviços locais encerrados, preservando os volumes.

## Limites

Uma conexão ociosa é reavaliada no próximo heartbeat: 25 segundos mais a latência da consulta. Uma notificação nova e cada quadro de replay passam pela consulta antes da escrita. Dados já enviados ao socket antes da revogação não podem ser recolhidos, e uma alteração concorrente após a leitura do banco pode preceder a próxima verificação. Não se promete revogação distribuída instantânea.

Existe uma consulta de identidade por quadro enviado. O teste prova correção e isolamento; vazão com alto volume de notificações e custo dessa consulta precisam dos testes de carga. Falhas retornadas pelo banco encerram a conexão; um timeout do banco depende dos limites de conexão/consulta configurados no ambiente. O cliente mantém seu comportamento existente de reconexão e replay.

Restam quatro achados originais: AU08 (motor genérico de automações), AU11 (ciclo de privacidade), AU12 (recuperação operacional) e AU13 (teclado telefônico). As limitações de sandbox financeiro e configuração do GitHub Pages continuam registradas nas etapas anteriores.
