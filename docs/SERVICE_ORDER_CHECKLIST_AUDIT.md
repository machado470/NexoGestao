# Checklist da execução — primeira entrega

O.S. agora apresenta um checklist próximo das fotos, antes do contexto recolhível no celular. Cada tarefa pode ser conferida durante a execução, com nome do profissional e data do servidor. Desmarcar exige motivo de pelo menos cinco caracteres. Cadastro e alterações geram Timeline e Auditoria na mesma transação.

## Regras e limites

- ADMIN/MANAGER/STAFF preparam tarefas em O.S. aberta, atribuída ou em execução. Somente O.S. em execução aceita novas marcações. VIEWER apenas consulta, de acordo com as permissões existentes por empresa.
- O.S. concluída ou cancelada não aceita novos itens nem alterações; tentativas repetidas de uma operação já confirmada podem recuperar o registro existente sem nova escrita. Checklist não altera status, não bloqueia conclusão da O.S. e não representa aceite do cliente.
- Até 30 tarefas por O.S., com descrição de 3–160 caracteres. Itens são preservados: edição de título, arquivamento, modelos reutilizáveis e checklist obrigatório configurável são fases posteriores. Não há sincronização offline ou rascunho persistente após recarregar.
- FK composta O.S./empresa e filtros na API impedem vínculo cruzado. Autor vem da sessão, nunca do payload. A restrição de terceiros apenas às próprias O.S. ainda não faz parte desta entrega.
- Lock da O.S. impõe limite sob concorrência e coordena mudanças com seu ciclo de vida. Versão por tarefa impede atualização sobre estado antigo. Repetição imediata da mesma marcação, pelo mesmo autor e motivo, recupera o estado confirmado sem duplicar histórico. Depois de mudanças posteriores, uma versão antiga retorna conflito em vez de sobrescrever dados.
- Criação usa chave de tentativa retida no formulário durante a montagem da tela. Falha mantém o texto; envios simultâneos ficam bloqueados e descarte de rascunho exige confirmação. Em conflito, atualizar e conferir o estado antes de uma nova decisão; a interface não deve pressupor sucesso.

## Implantação

Aplicar a migração aditiva `20261119150000_service_order_checklist` antes do tráfego da nova versão. A configuração de pre-deploy da API em `apps/api/railway.json` já roda `pnpm prisma:migrate:deploy`; verificar que o serviço usa esse arquivo. Não houve migração nem escrita em produção nesta auditoria.

## Validação local

- Migração aplicada em PostgreSQL 17 isolado, com Prisma diff sem divergência.
- Cinco testes HTTP com banco real: criação concorrente/idempotência; autenticação, função, empresa e payloads; conclusão/desmarcação/versionamento; O.S. encerrada/cancelada; limite concorrente e FK composta. O ValidationPipe do teste usa conversão implícita como produção; booleano e versão preservam o valor original para recusar strings, como `"false"`.
- Suíte web: 118 arquivos, 951 testes aprovados, incluindo três novos testes BFF de contratos e limites de entrada.
- TypeScript API/web e build Vite.
- Auditoria Chromium em 390 px escuro, 320 px claro e 1280 px: criar tarefa, perder resposta após commit e repetir sem duplicar, repetir marcação versionada, desmarcar com motivo, confirmar descarte e consultar como VIEWER. Contexto/autenticação são simulados; checklist usa API Nest/PostgreSQL reais locais. Não valida assinatura JWT real, Safari físico ou conta de produção.

Testes HTTP exigem explicitamente `CHECKLIST_TEST_DATABASE_URL=postgresql://nexo@127.0.0.1:55439/postgres` e Jest `src/service-orders/service-order-checklist.postgres.spec.ts`. Não usam `DATABASE_URL` e limpam apenas as organizações criadas pelo teste.

Auditoria de navegador: Vite em 5173, harness `apps/api/test/commerce-local-api.ts` no banco isolado e script `scripts/audits/service-order-checklist.cjs` com Playwright. O harness escuta somente loopback e não deve ser usado em produção.

## Próximo incremento

Aceite do cliente por fluxo próprio, garantia/retrabalho e materiais permanecem no plano consolidado. Não declarar a etapa inteira de execução comprovada concluída apenas com fotos e checklist.
