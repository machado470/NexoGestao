# O QUE FALTA NO NexoGestão
## Auditoria funcional real para fechamento de produto
**Atualização:** 15/03/2026  
**Status:** revisão orientada a execução  
**Objetivo:** manter visível apenas o que ainda impede o NexoGestão de operar como produto coerente, confiável e vendável

---

# 1. CONTEXTO

O NexoGestão já tem base arquitetural forte.

O fluxo estrutural oficial do sistema é:

cliente  
→ agendamento  
→ ordem de serviço  
→ execução  
→ cobrança  
→ pagamento  
→ timeline  
→ risco  
→ governança

Ou seja: o problema atual não é inventar módulo.

O problema atual é:

- fechar ciclo
- eliminar buraco funcional
- alinhar backend, frontend e operação
- transformar capacidade interna em valor visível no produto

---

# 2. RESUMO EXECUTIVO

## Estado atual
A base técnica está boa.  
Os módulos centrais existem.  
A arquitetura está coerente.  
O frontend já cobre partes importantes da operação.

## Problema real atual
Ainda existem lacunas entre:

- o que a arquitetura promete
- o que o backend expõe
- o que o frontend realmente usa
- o que o usuário final consegue executar até o fim

## Diagnóstico direto
O NexoGestão já deixou de ser “só projeto”.

Agora o risco não é falta de estrutura.  
O risco é parecer sistema grande, mas quebrar no uso real.

---

# 3. ORDEM REAL DE PRIORIDADE

## P0 — Fechar o fluxo operacional central
Precisamos garantir que este ciclo funcione sem remendo:

cliente  
→ agendamento  
→ ordem de serviço  
→ execução  
→ cobrança  
→ pagamento  
→ timeline  
→ risco  
→ governança

Se esse ciclo estiver sólido, o produto passa a ter cara de operação real.  
Se esse ciclo quebrar, o resto vira enfeite caro.

## P1 — Expor melhor no produto o que já existe na base
Especialmente:

- timeline
- risk
- governance
- notifications
- reports
- organization settings
- plans / subscriptions / billing
- automation
- audit

## P2 — Só depois ampliar inteligência e expansão lateral
Segurar por enquanto:

- múltiplos canais além de WhatsApp
- analytics rebuscado demais
- automação mega configurável
- inteligência preditiva sofisticada
- integrações externas demais
- relatórios super complexos
- machine learning e foguete de Marte

Primeiro o arroz.  
Depois a nave espacial.

---

# 4. GAPS FUNCIONAIS POR ÁREA

---

# 4.1 AUTH

## Situação atual
A autenticação básica existe.  
Login e registro já existem no web.  
Sessão via BFF também existe.  
Há caminho para onboarding e redirecionamento.  
Os papéis de usuário já foram padronizados para `ADMIN`, `MANAGER`, `STAFF` e `VIEWER`.

## O que ainda falta
- fluxo robusto de recuperação de senha ponta a ponta
- confirmação de email
- tratamento de erros mais consistente
- proteção de rotas mais explícita no frontend
- controle melhor de loading e sessão expirada
- política clara de permissões por tela
- alinhamento definitivo entre frontend e backend no consumo de roles

## Prioridade
P0

---

# 4.2 CUSTOMERS

## Situação atual
Clientes já existem como entidade central do sistema.

## O que ainda falta
- endereço completo estruturado
- histórico de contato
- notas operacionais úteis
- workspace de cliente mais rico
- timeline de cliente forte no frontend
- filtros e busca melhores
- estados mais claros de ativo/inativo
- preparação para múltiplos serviços por cliente

## Gap principal
Cliente existe, mas ainda não está plenamente tratado como centro da operação.

## Prioridade
P0

---

# 4.3 APPOINTMENTS

## Situação atual
Agendamento existe e já faz parte do fluxo oficial.

## O que ainda falta
- calendário visual melhor
- confirmação real de agendamento
- lembrete automático
- remarcação robusta
- cancelamento com motivo
- disponibilidade real de horário
- status operacionais mais claros
- integração melhor com comunicação

## Gap principal
O agendamento existe como registro.  
Ainda precisa virar fluxo operacional confiável.

## Prioridade
P0

---

# 4.4 SERVICE ORDERS

## Situação atual
Ordem de serviço já existe e é peça central do modelo operacional.  
Também já aparece no frontend.

## O que ainda falta
- vinculação mais clara com execução real
- início e fim de execução mais consistentes
- campos operacionais úteis no fechamento da OS
- atualização de status com regras melhores
- geração automática de cobrança ao concluir serviço
- vínculo mais forte entre OS, timeline e risco
- suporte futuro a anexos e evidências

## Gap principal
A OS já existe, mas ainda precisa ser a unidade real de execução do produto.

## Prioridade
P0

---

# 4.5 FINANCE

## Situação atual
O sistema financeiro oficial gira em torno de Charge e Payment.

## O que ainda falta
- pagamento realmente integrado no produto
- fechamento completo cobrança → pagamento → atualização de status
- geração automática de cobrança após conclusão de serviço
- visão financeira mais forte por cliente
- consistência entre charges, invoices, launches e expenses
- dashboard financeiro mais operacional
- lembretes automáticos de cobrança
- confirmação automática de pagamento em timeline e comunicação
- futura separação clara entre billing SaaS e financeiro operacional

## Gap principal
O financeiro existe, mas ainda está fragmentado entre módulos.

## Prioridade
P0

---

# 4.6 WHATSAPP

## Situação atual
A comunicação operacional é pilar oficial do sistema.  
O WhatsApp é o canal principal definido na documentação.

## O que ainda falta
- envio automático realmente amarrado a eventos
- templates padronizados por tipo
- confirmação automática de agendamento
- lembrete de serviço
- envio de link de pagamento
- confirmação de pagamento
- retry e tratamento de falhas
- histórico melhor por entidade operacional
- status de entrega mais confiável
- integração sólida com timeline

## Gap principal
Hoje o WhatsApp tende a existir mais como capacidade técnica do que como motor operacional fechado.

## Prioridade
P0

---

# 5. GAPS TRANSVERSAIS

---

# 5.1 TIMELINE

## Situação atual
A timeline é fonte oficial de histórico operacional.

## O que ainda falta
- uso mais forte no frontend
- visualização por cliente
- visualização por ordem de serviço
- visualização financeira
- filtros por tipo de evento
- consistência de metadados
- garantia de que eventos críticos estão sendo gerados nos fluxos principais

## Prioridade
P1

---

# 5.2 RISK ENGINE

## Situação atual
O motor de risco é um dos diferenciais centrais do NexoGestão.

## O que ainda falta
- tornar o risco mais visível no frontend operacional
- explicar claramente por que o risco mudou
- ligar eventos operacionais ao score de forma transparente
- exibir histórico de risco
- tornar o impacto do risco mais acionável

## Prioridade
P1

---

# 5.3 GOVERNANÇA

## Situação atual
Governança é pilar oficial da plataforma.

## O que ainda falta
- experiência mais clara para leitura de execuções
- maior ligação com alertas operacionais
- explicação das decisões tomadas
- exibição melhor das transições de estado operacional
- visão administrativa mais forte
- correlação mais clara com risco e timeline

## Prioridade
P1

---

# 5.4 AUDITORIA

## Situação atual
Auditoria e histórico estão previstos como parte da arquitetura.

## O que ainda falta
- persistência forte e consistente dos logs críticos
- interface de consulta
- auditoria por entidade
- auditoria por usuário
- diferenciação clara entre timeline operacional e auditoria administrativa

## Prioridade
P1

---

# 5.5 NOTIFICAÇÕES

## Situação atual
O sistema prevê Notification Center em tempo real.

## O que ainda falta
- uso consistente no frontend
- alertas úteis e priorizados
- integração com eventos reais
- agrupamento por severidade
- leitura/não leitura
- integração com governança, financeiro e operação

## Prioridade
P1

---

# 6. BACKEND RICO E FRONTEND AINDA SUBAPROVEITANDO

Hoje já existem capacidades importantes no backend que ainda não aparecem no produto com a força que deveriam:

- Risk
- Governance
- Timeline
- Audit
- Notifications
- Reports
- Organization Settings
- Plans
- Subscriptions
- Billing
- Automation
- Analytics
- Pending / Exceptions / Corrective Actions
- Invites
- Email

## Diagnóstico
Aqui mora um risco clássico:

**backend rico + frontend magro = produto com potencial alto e percepção baixa**

---

# 7. CHECKLIST EXECUTÁVEL

## Fluxo central
- [ ] cliente cria, edita e sustenta agenda / OS / cobrança
- [ ] agendamento confirma, remarca, cancela e lembra
- [ ] OS cria, executa, conclui e registra evento
- [ ] cobrança nasce sem remendo
- [ ] pagamento fecha o ciclo corretamente
- [ ] timeline registra eventos críticos
- [ ] risco recalcula com coerência
- [ ] governança reage com clareza

## Auth
- [ ] login
- [ ] registro
- [ ] sessão
- [ ] logout
- [ ] forgot password
- [ ] reset password
- [ ] proteção de rota
- [ ] permissões por role no frontend

## Customers
- [ ] listagem
- [ ] criação
- [ ] edição
- [ ] dados completos
- [ ] timeline por cliente
- [ ] histórico de contato

## Appointments
- [ ] criação
- [ ] confirmação
- [ ] remarcação
- [ ] cancelamento
- [ ] lembrete
- [ ] vínculo com cliente

## Service Orders
- [ ] criação
- [ ] atualização de status
- [ ] início de execução
- [ ] conclusão
- [ ] vínculo com cobrança
- [ ] timeline operacional

## Finance
- [ ] criação de cobrança
- [ ] listagem
- [ ] cobrança vencida
- [ ] pagamento
- [ ] atualização de status
- [ ] comunicação financeira

## WhatsApp
- [ ] envio manual
- [ ] envio automático
- [ ] templates
- [ ] status de entrega
- [ ] retry
- [ ] registro na timeline

## Controle operacional
- [ ] timeline funcionando
- [ ] risco recalculando
- [ ] governança reagindo
- [ ] alertas aparecendo

---

# 8. PRÓXIMO FOCO RECOMENDADO

## Ordem sugerida
1. auth
2. customers
3. appointments
4. service orders
5. finance
6. whatsapp
7. timeline
8. risk
9. governance
10. settings / plans / billing / reports

---

# 9. CRITÉRIO DE PRONTO POR FLUXO

## Auth pronto
- usuário entra
- usuário sai
- sessão persiste certo
- sessão expira sem quebrar UI
- erro de login aparece limpo
- frontend respeita permissões reais por papel

## Customer pronto
- cliente nasce limpo
- cliente edita limpo
- cliente aparece onde precisa aparecer
- cliente sustenta agendamento, OS e cobrança

## Appointment pronto
- agenda cria
- agenda lista
- agenda atualiza
- agenda conversa com cliente
- agenda prepara comunicação

## Service Order pronta
- OS nasce
- OS executa
- OS conclui
- OS registra evento
- OS prepara financeiro

## Finance pronto
- cobrança nasce
- cobrança muda de status
- pagamento fecha ciclo
- histórico financeiro bate com operação

## WhatsApp pronto
- mensagem sai com contexto
- evento relevante pode disparar mensagem
- histórico fica rastreável
- falha fica visível

---

# 10. FRASE-GUIA

O NexoGestão não precisa parecer enorme.

Ele precisa parecer inevitável para a operação.

Menos expansão lateral.  
Mais fluxo completo.

Menos “já temos backend pra isso”.  
Mais “o usuário conseguiu usar até o fim”.
