# Indisponibilidade por pessoa — 18/11/2026

O formulário de indisponibilidade usava os mesmos campos e erro para toda a tela. Ao trocar de pessoa, o rascunho anterior aparecia em outro cadastro. O sucesso de uma gravação limpava os campos da seleção atual, e o erro de remoção também era global.

Rascunhos, validação e erros de remoção agora pertencem ao personId. Os callbacks usam o personId enviado na mutation, independentemente de qual pessoa esteja aberta quando a resposta chega. Trocar A/B preserva cada rascunho; uma confirmação limpa somente os campos de A. Nenhum estado operacional/capacidade é calculado pelo novo reducer.

Após confirmação, as consultas são atualizadas em segundo plano e a lista de exceções é invalidada somente para a pessoa afetada. Uma leitura lenta não mantém a mutation pendente. A remoção fica desabilitada durante a atualização da lista, para não oferecer outra exclusão de um registro antigo. Erros de leitura e dados oficiais continuam sob as consultas existentes.

Validação: 40 testes de rascunhos por pessoa, intervalo, fuso e contratos da tela, TypeScript e build Vite. scripts/audits/people-availability-context.cjs passou em 320/390 px: fim anterior ao início sem POST; A/B com rascunhos distintos; clique duplo com um único envio pendente; resposta de A enquanto B está aberta; conversão de 09h da empresa para 12h UTC; leitura retida após confirmação; erro de remoção de A sem aparecer em B; nova remoção e bloqueio do registro antigo durante refetch. A regressão people-mobile-flow passou novamente para cadastro/edição.

A automação aguarda o encerramento do menu de ações antes de interagir com o detalhe, incluindo a retirada de aria-hidden pelo Radix. As APIs usam fixtures locais com dois cadastros e registros em memória, sem alterações de pessoas/agenda reais. Os rascunhos não são persistidos entre recargas ou sessões. Não foi adicionada idempotência entre sessões, nem alteradas permissões/contratos do serviço. API de produção, Safari/iPhone real e teclado nativo não foram executados.
