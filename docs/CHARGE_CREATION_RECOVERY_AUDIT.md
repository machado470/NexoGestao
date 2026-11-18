# Recuperação da criação de cobrança — 18/11/2026

A criação manual gerava uma chave de idempotência nova em cada clique. Se o serviço salvasse e a resposta se perdesse, repetir o envio podia representar outra criação. A mesma tentativa agora guarda uma chave por cliente, valor em centavos, vencimento e observações. Uma resposta incerta mantém a chave; uma confirmação libera uma nova chave para uma cobrança intencionalmente nova. Um bloqueio síncrono impede dois envios enquanto a mutation está em andamento. Não há retry automático de writes.

A criação confirmada fecha e limpa o formulário antes da sincronização das consultas. Falhar ao reler a carteira não transforma a confirmação em um cadastro novamente editável. O feedback não afirma que a sincronização terminou. Foi removida a inserção otimista de cobrança pendente em uma chave de cache que não correspondia à consulta paginada: a carteira continua dependendo dos registros retornados pelo serviço.

O formulário recebe agora o customerId do contexto do Financeiro e prepara o cliente ao abrir. O preenchimento inicial é a referência de rascunho: abrir e cancelar sem editar não pede descarte. Reabrir começa com o cliente contextual e os demais campos limpos.

A retenção de chaves é em memória no componente, inclusive entre fechar/reabrir o modal enquanto ele permanece montado. Não sobrevive a recarga, troca de página ou encerramento do navegador; não é uma garantia de deduplicação entre sessões. A proteção final continua dependendo do contrato de idempotência do serviço, que já recebe a chave pelo BFF.

Validação local: 43 testes de tentativas de cobrança, fluxo de pagamento e contratos/navegação financeira; TypeScript e build Vite. O roteiro scripts/audits/charge-creation-recovery.cjs verificou cliente contextual, cancelamento sem alteração, clique duplo, resposta interrompida após persistência simulada, repetição com a mesma chave, erro nas leituras após confirmação e criação intencional com chave nova em 320/390 px. A regressão scripts/audits/mobile-customer-to-payment.cjs passou e passou a exigir que a cobrança aberta pelo cadastro tenha o cliente selecionado.

Todas as APIs dos roteiros são interceptadas com fixtures locais. Nenhuma cobrança ou pagamento real foi criado, e a deduplicação do backend de produção não foi executada. Safari/iPhone real não testado nesta rodada.
