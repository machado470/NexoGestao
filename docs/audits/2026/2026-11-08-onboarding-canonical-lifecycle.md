# Jornada inicial e ciclo canônico da O.S.

## Falhas encontradas

- A jornada tentava concluir uma O.S. recém-criada em OPEN diretamente como DONE, transição rejeitada pela API.
- Uma falha intermediária deixava uma O.S. criada sem preservar seu id para retomada.
- Qualquer O.S. existente podia marcar a etapa de conclusão como pronta, mesmo ainda aberta.
- A cobrança usava conversão numérica diferente dos formulários financeiros e não vinculava a O.S.
- A sessão validada descartava o indicador oficial `requiresOnboarding`, encaminhando contas novas ao dashboard.
- A checagem de tipos expôs um setter de ativação de clientes recebendo callback após a migração do formulário para reducer. O botão agora envia o booleano diretamente.

## Alteração

A jornada exige selecionar o responsável e executa ASSIGNED → IN_PROGRESS → DONE, usando a versão retornada a cada transição. Ordens abertas retomadas passam por atribuição antes de iniciar. O id criado é preservado antes das atualizações e uma nova tentativa consulta a mesma ordem. Uma ordem com o mesmo cliente e título pode ser retomada da lista carregada após recarregar a página. Ordens canceladas não são avançadas.

A conclusão da etapa é inferida de O.S. em DONE. A cobrança usa o conversor monetário compartilhado, aceita vírgula decimal e envia `amountCents` com o vínculo à ordem concluída do cliente. A sessão preserva o indicador oficial de onboarding e o redirecionamento correspondente; a finalização atualiza a sessão antes de navegar ao dashboard.

Não houve alteração nas regras de estado da API nem exercício de integrações externas.

## Verificação

- Suíte geral final do frontend: 90 arquivos, 730 testes passaram.
- Recorte final: 20 testes passaram, incluindo os dois novos casos de preservação do indicador oficial da sessão.
- Seis testes do ciclo da O.S. cobrem sequência e versões, retomada sem recriação, atribuição de ordem aberta, ordem já concluída, ausência de responsável e ordem cancelada.
- Typecheck final sem erros após corrigir o setter de ativação; build final, lint e `git diff --check` passaram.
- Chromium com API, BFF, PostgreSQL e Redis locais: conta nova entrou na jornada pelo login; cliente e agendamento foram criados; a primeira tentativa de IN_PROGRESS recebeu HTTP 503; a repetição consultou a mesma O.S. e executou IN_PROGRESS e DONE sem criar outra. A cobrança de `150,25` persistiu 15.025 centavos com `serviceOrderId` correspondente. Finalizar atualizou a sessão e abriu o dashboard, com `requiresOnboarding: false` no banco.
- Script temporário em `work/onboarding-flow-browser.cjs`. WhatsApp permaneceu mock; nenhum envio externo foi exercitado. Serviços e banco temporários foram encerrados após a validação.
