# Limpeza determinística das fixtures de notificações — 12/11/2026

Base `a5ff6ebb`, branch `fix/ci-privacidade-integracao`, raiz `/workspace/NexoGestao`. Início limpo, sem AGENTS.md aplicável. Mantidos PNPM 10.30.3, Nest/Jest, PostgreSQL/Redis reais e os comandos existentes. Nenhum código de produção ou workflow foi alterado.

## Diagnóstico

O PR #1046 foi integrado com Compose aprovado e dois `quality-gates` reprovados. O job [130949872193](https://github.com/machado470/NexoGestao/actions/runs/43147881223/job/130949872193) executou **151 testes aprovados**, mas a suíte `notification-session-postgres.integration.spec.ts` falhou no `afterAll`: organização de teste ainda referenciada por `TimelineEvent_orgId_fkey`. [Trecho do CI](notification-cleanup-evidence/ci-failure.txt).

O AppModule registra o agendador operacional a cada cinco minutos. A suíte SSE dura pelo menos 25 segundos e podia atravessar essa fronteira, gerando Timeline para suas pessoas. A limpeza apagava pessoas/usuários/organizações sem remover o histórico e antes de encerrar a aplicação. O ensaio local anterior com agendador desativado não cobria essa combinação. Esta é uma falha do isolamento/limpeza do teste introduzido no AU06; o log não demonstra falha da exportação ou da revogação em produção.

## Correção

Em `apps/api/test/integration/notification-session-postgres.integration.spec.ts`:

- Substitui somente o provider do agendador operacional no módulo desta suíte, evitando depender do minuto do relógio. O serviço real continua disponível.
- Novo cenário invoca `OperationalStateService.syncAndLogStateChange` diretamente, confirma Timeline persistida e verifica que revogação encerra o socket, impede entregar o novo evento e retorna HTTP 401.
- Encerra a aplicação antes do cleanup, usa cliente Prisma próprio e remove as dependências geradas antes das organizações, sempre limitado aos UUIDs da própria execução. Confirma que as organizações foram removidas.

Não enfraquece asserts de permissão/revogação nem desativa agendadores no produto ou globalmente em outras suítes.

## Evidências

O novo cenário com o cleanup antigo reproduziu deterministicamente o mesmo erro: **8 testes passaram, suíte falhou no afterAll**. [Antes](notification-cleanup-evidence/before.txt).

- **`pnpm --filter ./apps/api test:integration:real`: 165 testes passaram, 28 suítes aprovadas, 20 testes condicionais ignorados.** Inclui os oito cenários SSE e os 14 de exportação. [Depois](notification-cleanup-evidence/after.txt).
- **`pnpm --filter ./apps/api typecheck`: passou.** [Tipos](notification-cleanup-evidence/types.txt).
- Comandos executados com `npx --yes pnpm@10.30.3`, PostgreSQL local 55449 e Redis 56389/12. O comando de integração usa o mesmo script do CI; as suítes condicionais habilitadas dependem também do ambiente local existente.
- `git diff --check`: passou. Não se repetiram build, lint web ou navegador: esta etapa modifica somente teste de API e documentação. O CI remoto da correção será acompanhado separadamente; aprovação local não implica aprovação remota.

Dados fictícios no banco local de teste; nenhuma mensagem, pagamento ou chamada a provedor externo. As nove organizações deixadas pelo ensaio propositalmente falho foram removidas usando os UUIDs extraídos do seu log e conferindo o nome sintético. Nenhum reset, volume removido ou alteração em produção. Esta correção não encerra AU08, AU11 ou AU12.
