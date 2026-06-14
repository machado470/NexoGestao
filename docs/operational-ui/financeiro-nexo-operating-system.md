# Financeiro — Nexo Operating System UI

Financeiro é o cockpit de conversão da execução em receita. A página `/finances` não deve se comportar como uma tabela administrativa de ERP: ela deve ajudar o operador a decidir, cobrar, reduzir risco de caixa, enxergar evidência e executar ações reais já existentes.

## Direção operacional

- **Hero como contexto:** o topo deve resumir dinheiro recebido, dinheiro pendente, dinheiro em risco/vencido, maior cobrança em atraso, cliente prioritário e próxima ação financeira com os dados já carregados.
- **Decisão como comando:** o bloco dominante deve responder “FAÇA AGORA” com estado, risco, impacto, motivo, próxima ação e segurança. O CTA principal precisa direcionar para fluxo real existente.
- **Carteira como apoio operacional:** a lista deve ser uma carteira de cobranças selecionáveis, destacando cliente, valor, status, vencimento/atraso, origem operacional humanizada, prioridade e CTA principal.
- **Detalhe como cockpit de cobrança:** o detalhe deve organizar Cliente, Cobrança, Recebimento, Origem operacional, Comunicação e Evidência/Timeline, sem expor identificadores técnicos.
- **Timeline como prova:** eventos financeiros devem ser humanizados para linguagem de negócio: Cobrança criada, Cobrança enviada, Lembrete de cobrança preparado, Lembrete de cobrança enviado, Pagamento registrado, Cobrança cancelada, Ação financeira registrada ou Evento financeiro registrado.
- **Radar como alerta:** alertas compactos devem mostrar cliente/problema, impacto, próxima ação e CTA real como “Resolver”, sem mensagens técnicas da infraestrutura.
- **Saúde do caixa como auxiliar:** recebido, pendente, em risco e saúde financeira permanecem visíveis, mas não competem com o comando operacional.

## Proibição de vazamento técnico

A UI do operador não deve exibir UUID, hash, ID cru, nomes de endpoint, BFF, backend, payload, metadata, `eventType`, `EXECUTION_STARTED`, `EXECUTION_EXECUTED`, `action-send-overdue-charge-reminder` ou `action-create-charge-followup`.

Quando a fonte atual não trouxer dado suficiente, usar fallback honesto de negócio, como “Evento financeiro registrado”, “Sem O.S. vinculada” ou “Origem não informada pela fonte atual”.

## Limites preservados

Esta direção não altera backend, API, Prisma, rotas, contratos, segurança multi-tenant, WhatsAppPage, automações, mocks ou seeds. A página pode apenas reorganizar e humanizar dados já carregados e acionar fluxos reais existentes.
