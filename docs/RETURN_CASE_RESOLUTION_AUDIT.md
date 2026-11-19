# Encerramento do acompanhamento de retorno

## Fluxo

No detalhe da O.S. original ou do retorno, ADMIN/MANAGER podem encerrar o acompanhamento interno com desfecho obrigatório (10–1000 caracteres). A O.S. deve estar concluída com condição comercial definida, ou cancelada. Cancelamento pode encerrar um caso ainda pendente de cobertura: o registro é administrativo, não comprova execução.

Reabrir o acompanhamento também exige justificativa. Isso não reabre a execução da O.S.; para nova visita, abrir outro retorno ou usar os fluxos operacionais disponíveis. STAFF/VIEWER consultam estado, último motivo, autor e data. Alterações anteriores permanecem na Timeline das duas O.S. e na Auditoria. Retornos existentes começam em aberto, sem presumir desfecho pelo estado da execução.

Encerramento não altera cobertura, cobrança, pagamento, aceite, datas ou responsável; não envia mensagens. Encerrar um caso cobrável não representa quitação e não elimina sinais financeiros. Pendências financeiras continuam nos módulos normais. Este incremento não exige aceite do cliente nem oferece assinatura digital. Links de aceite pendentes continuam com a validade original, pois esta anotação interna não altera o conteúdo da O.S.

Antes de revisar cobertura de um caso encerrado, reabrir o acompanhamento. Uma resposta perdida da mesma decisão comercial já gravada continua recuperável sem repetir efeitos.

## Consistência e interface

- Versão específica de acompanhamento e motivo/autor autenticado. Repetição imediata de mesma versão de origem, destino, motivo e autor devolve o registro; alteração concorrente retorna 409.
- Transação bloqueia a O.S. de retorno na mesma ordem de locks da cobertura. Evita que uma O.S. concluída seja encerrada simultaneamente com mudança da cobertura para pendente.
- Encerrar/reabrir altera somente o caso, duas entradas de Timeline e Auditoria. Repetição não duplica eventos. Sem reserva comercial ou escrita externa.
- Modal preserva motivo após falha, bloqueia duplo envio e pede confirmação ao descartar. Refetch não muda silenciosamente a versão de um rascunho. Em conflito, fechar/reabrir o formulário para revisar a situação atual. Sem rascunho offline após recarregar.
- API antiga sem campos de acompanhamento: nova interface omite a ação durante deploy independente. Campos opcionais no contrato de leitura permitem atualização gradual. Permissões de escrita são validadas na API.

## Implantação

Aplicar `20261119190000_return_case_resolution` antes da API nova. O pre-deploy de `apps/api/railway.json` já executa migrações. Migração aditiva, sem reclassificar execução ou financeiro. Constraints verificam estado e consistência dos dados da última revisão. Rollback para a API anterior preserva os dados, mas a versão anterior não aplica a exigência de reabrir antes de revisar cobertura; manter API nova enquanto essa regra for necessária.

Nenhuma migração ou escrita em produção nesta auditoria.

## Validação

Banco isolado PostgreSQL 17, com Nest HTTP real: cinco cenários de permissão/empresa/payload, elegibilidade, concorrência/idempotência, revisão/reabertura, cancelamento e corrida com cobertura. As três suítes de retorno (abertura, cobertura e acompanhamento) somam 15 testes aprovados. Front: 122 suítes e 962 testes aprovados; TypeScript API/web, build Vite e migration diff sem divergência. Com as suítes existentes de retorno e cobertura: 15 testes aprovados. Estados terminais e financeiro são fixtures locais; JWT/autenticação e admissão do plano são simulados.

`RETURN_CASE_TEST_DATABASE_URL=postgresql://nexo@127.0.0.1:55439/postgres`, arquivo `apps/api/src/service-orders/return-case-resolution.postgres.spec.ts`. Não usa DATABASE_URL para selecionar banco e remove apenas fixtures próprias.

Contratos BFF, TypeScript API/web, build Vite e suites de regressão. Auditoria Chromium 320/390/1280 px em `scripts/audits/return-case-state.cjs`: encerrar com resposta perdida/repetir, reabrir, descarte, funções e largura. Usa Nest/PostgreSQL locais reais para decisões, autenticação/contexto de leitura simulados e preparação direta de execução concluída como fixture. Não testa Safari físico ou produção.

## Ainda pendente

Política automática de elegibilidade/prazo, SLA do acompanhamento, materiais e custo de retrabalho, orçamento aprovado pelo cliente, ajustes financeiros e relatório consolidado de retornos. O encerramento entregue é uma decisão administrativa explícita, não uma confirmação de satisfação.
