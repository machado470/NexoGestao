# WhatsApp → Financeiro: navegação e registro de pagamento

## Entrega

- WhatsApp, Clientes, Agenda e O.S. usam `useSearch` para ler os parâmetros de navegação. No Wouter 3, `useLocation` entrega o pathname separado da query; dividir esse valor por `?` perdia os identificadores.
- O contexto financeiro do WhatsApp oferece `Registrar pagamento`, que abre o formulário financeiro canônico para a cobrança indicada. Abrir o link não executa pagamento: o operador ainda revisa e confirma o formulário.
- Financeiro consulta a cobrança pelo endpoint dedicado e não depende de ela aparecer entre os primeiros 500 registros da carteira. Carregamento, falta de acesso e erro têm estados próprios. Falha da carteira não oculta uma cobrança selecionada acessível.
- Links com `customerId` filtram a carteira pelo identificador exato; o operador pode limpar o filtro.
- O detalhe da cobrança inclui O.S., valor pago, saldo e avaliação de atraso calculados no backend, com filtro de tenant preservado. O frontend não recalcula o saldo.
- Links de cobranças pagas/canceladas não oferecem registro de pagamento. O backend continua responsável por autorizar e validar a operação.

## Testes

Seis novos testes de renderização usam o Router real do Wouter com pathname e query separados. Cobrem cobrança fora da carteira, indisponibilidade independente, ausência de identificador, falta de acesso, filtro por cliente e cobrança já paga. Três novos testes da API cobrem filtro de tenant, saldo após pagamento parcial, saldo zero e registro inexistente.

As suítes de contrato de Financeiro, Clientes e WhatsApp também são executadas para detectar regressões. Esses testes não comprovam integração com provedores externos ou navegação em navegador real.

Resultados desta rodada: 584 testes web aprovados em 77 arquivos e 28 testes do serviço financeiro aprovados. Build dos três pacotes, checagem de tipos e lint operacional web aprovados. As demais suítes da API já validadas na etapa anterior não foram repetidas nesta rodada.

## Pendências mantidas

A ação de pagamento passa pelo Financeiro existente; não foi criado um segundo formulário de pagamento dentro do WhatsApp. Continuam pendentes validação com provedores reais de e-mail, WhatsApp e Stripe, gestão de convites expirados e rastreamento dedicado dos eventos de envio na timeline. As pendências de foco por query e acesso ao formulário financeiro registradas na auditoria administrativa anterior são atendidas por esta entrega.
