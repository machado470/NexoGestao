# Cadastro e edição de clientes no celular

## Alterações

A edição usava `window.confirm` ao fechar e recarregar, enquanto outros formulários já usavam confirmação visual própria. Cadastro e edição também não registravam proteção da navegação SPA/Voltar.

- Edição usa o diálogo compartilhado de descarte para fechar e para recarregar, com decisões independentes. A recarga só substitui o rascunho após receber dados válidos; falha preserva campos e versão de concorrência.
- O rodapé da edição mantém apenas Salvar/Cancelar; recarga fica no corpo. O aviso de abertura que cobria Salvar em 320 px e a confirmação duplicada após atualizar foram removidos. A confirmação da gravação continua no editor.
- Cadastro e edição protegem a navegação. Após cadastro confirmado, a continuação fica liberada mesmo enquanto consultas posteriores estão pendentes.
- Campos/status ficam bloqueados durante atualização; dados carregados também ficam bloqueados durante recarga. Salvar fica indisponível enquanto a consulta está em andamento, além da trava síncrona existente contra duplicação.
- Rodapé da edição contém Salvar/Cancelar; status e Recarregar dados ficam no corpo, reduzindo a altura no celular.
- Leitura do editor usa uma tentativa adicional para falhas temporárias, conforme helper compartilhado. Tentativa em andamento mostra carregamento, com recuperação explícita se falhar. Regras de gravação, campos enviados e versão esperada são preservados.

## Validação local

32 testes de rascunho, fluxo de atualização e contrato operacional de Clientes; TypeScript e build Vite.

`customer-editor-drafts.cjs` em Chromium, 320/390 px, com respostas interceptadas: primeira leitura com duas falhas e recuperação explícita; fechar/continuar sem diálogo nativo; Escape; cancelar recarga; recarga com erro preservando nome; recarga confirmada recuperando dados; Voltar com continuar e descarte na edição/cadastro; novo editor com dados originais; clique duplo enviando uma atualização; campos/Cancelar bloqueados enquanto pendente; erro preservando rascunho; confirmação fechando antes de consultas retidas. Cadastro confirmado continua para agendamento com customerId correto sem aguardar essas consultas.

A regressão `mobile-customer-to-payment.cjs` passou: cadastro, agenda, O.S., cobrança, pagamento, pesquisa/edição e continuação escolhida.

## Limites

Nenhum registro real alterado. API de produção e Safari/iPhone real não testados. Rascunhos permanecem apenas em memória; recarga/descarte autorizado ou encerramento da aba podem apagá-los. Não há nova idempotência de cadastro/atualização. A saída nativa depende do navegador, conforme hook existente.
