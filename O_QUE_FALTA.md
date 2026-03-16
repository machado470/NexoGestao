# O QUE FALTA NO NexoGestão
## Auditoria funcional real para fechamento de produto
**Atualização:** 15/03/2026  
**Status:** revisão orientada a execução  
**Objetivo:** manter visível apenas o que ainda impede o NexoGestão de operar como produto coerente, confiável e vendável

**Legenda**
- [x] existe e está funcional como base
- [~] existe, mas ainda está incompleto, subexposto ou fecha mal o fluxo
- [ ] ainda falta construir ou fechar de verdade

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

## Correção importante desta revisão
O sistema está mais avançado do que este arquivo dizia antes.

Hoje já existem bases reais para:

- proteção de rota e permissões no frontend
- forgot password e reset password
- confirmação e cancelamento de agendamento
- início e conclusão de ordem de serviço
- geração automática e manual de cobrança
- registro de pagamento
- disparos automáticos de WhatsApp em alguns eventos
- workspace operacional por cliente

O problema deixou de ser “não existe”.  
O problema agora é “existe, mas ainda não fecha ciclo com clareza suficiente”.

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
A proteção de rotas já existe no frontend com validação de autenticação, onboarding, roles e permissions.  
Forgot password e reset password já existem como base técnica.

## O que ainda falta
- fluxo robusto de recuperação de senha ponta a ponta validado em produção
- confirmação de email
- tratamento de erros mais consistente
- controle melhor de loading e sessão expirada
- política clara de permissões por tela
- refinamento da UX de sessão expirada
- alinhamento definitivo entre frontend e backend no consumo de roles

## Gap principal
Auth já existe de verdade.  
O que falta é deixá-lo mais confiável e mais polido no uso real.

## Prioridade
P0

---

# 4.2 CUSTOMERS

## Situação atual
Clientes já existem como entidade central do sistema.  
Listagem, criação e edição já funcionam.  
Já existe workspace operacional por cliente no frontend com visão consolidada de agendamentos, ordens de serviço, cobranças e timeline.

## O que ainda falta
- endereço completo estruturado
- histórico de contato
- notas operacionais mais fortes
- filtros e busca melhores
- estados mais claros de ativo/inativo
- preparação para múltiplos serviços por cliente
- enriquecimento do workspace de cliente

## Gap principal
Cliente já é entidade funcional.  
Ainda falta virar centro operacional mais maduro e mais completo.

## Prioridade
P0

---

# 4.3 APPOINTMENTS

## Situação atual
Agendamento existe e já faz parte do fluxo oficial.  
Criação funciona.  
Confirmação, cancelamento, conclusão e no-show já existem como transições reais de status.  
Há integração parcial com timeline, audit, risk e WhatsApp.

## O que ainda falta
- calendário visual melhor
- remarcação robusta como experiência explícita
- cancelamento com motivo
- lembrete automático confiável
- disponibilidade real de horário
- explicação operacional melhor no frontend
- integração mais forte com comunicação

## Gap principal
O agendamento já deixou de ser só registro.  
Ainda precisa virar fluxo operacional mais completo e mais amigável.

## Prioridade
P0

---

# 4.4 SERVICE ORDERS

## Situação atual
Ordem de serviço já existe e é peça central do modelo operacional.  
Também já aparece no frontend.  
Início e conclusão de execução já existem como base.  
Há registro em timeline e audit.  
Ao concluir uma O.S., já existe tentativa de gerar cobrança automaticamente.  
Também existe geração manual de cobrança por endpoint e frontend.

## O que ainda falta
- vínculo mais claro com execução real
- campos operacionais mais ricos no fechamento da OS
- UX melhor para execução e conclusão
- vínculo mais forte entre OS, timeline e risco
- explicação mais visível do fechamento OS → cobrança
- suporte futuro a anexos e evidências

## Gap principal
A OS já existe como unidade operacional real.  
Ainda precisa fechar melhor o ciclo visível de execução até financeiro.

## Prioridade
P0

---

# 4.5 FINANCE

## Situação atual
O sistema financeiro oficial gira em torno de Charge e Payment.  
Criação e listagem de cobrança existem.  
Pagamento já existe como fluxo real.  
Cobrança pode nascer de forma manual e também a partir da conclusão da O.S.  
Há timeline, audit, notificação e disparos de WhatsApp em partes do ciclo.

## O que ainda falta
- visão financeira mais forte por cliente
- dashboard financeiro mais operacional
- fechamento mais claro no frontend entre cobrança, pagamento e histórico
- consistência mais visível entre charges, invoices, launches e expenses
- futura separação clara entre billing SaaS e financeiro operacional
- revisão fina de alguns tipos/eventos internos ainda suspeitos

## Gap principal
O financeiro já não está ausente.  
O problema agora é integração visível e coerência de ponta a ponta.

## Prioridade
P0

---

# 4.6 WHATSAPP

## Situação atual
A comunicação operacional é pilar oficial do sistema.  
O WhatsApp é o canal principal definido na documentação.  
Já existem disparos automáticos em alguns eventos, como confirmação de agendamento, link de pagamento, recibo e lembrete de cobrança.

## O que ainda falta
- templates padronizados por tipo
- status de entrega mais confiável
- retry mais claro e verificável
- histórico melhor por entidade operacional
- integração mais sólida com timeline
- cobertura mais ampla dos eventos do fluxo operacional
- melhor visibilidade do que foi disparado, quando e por quê

## Gap principal
WhatsApp já deixou de ser só capacidade técnica manual.  
Ainda falta virar motor operacional plenamente confiável e rastreável.

## Prioridade
P0

---

# 5. GAPS TRANSVERSAIS

---

# 5.1 TIMELINE

## Situação atual
A timeline é fonte oficial de histórico operacional.  
Ela já está sendo alimentada em partes importantes do fluxo.

## O que ainda falta
- uso mais forte no frontend
- visualização por cliente
- visualização por ordem de serviço
- visualização financeira
- filtros por tipo de evento
- consistência melhor de metadados
- garantia de que todos os eventos críticos do fluxo principal estejam sendo gerados

## Prioridade
P1

---

# 5.2 RISK ENGINE

## Situação atual
O motor de risco é um dos diferenciais centrais do NexoGestão.  
Já há recálculo em alguns eventos operacionais.

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
A base já existe no backend.

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
Auditoria já aparece no fluxo técnico de vários módulos.  
Ela deixou de ser apenas intenção arquitetural.

## O que ainda falta
- interface de consulta
- auditoria por entidade de forma mais visível
- auditoria por usuário
- diferenciação mais clara entre timeline operacional e auditoria administrativa
- leitura mais simples para administração

## Prioridade
P1

---

# 5.5 NOTIFICAÇÕES

## Situação atual
O sistema prevê Notification Center em tempo real.  
Já há criação de notificações em alguns fluxos.

## O que ainda falta
- uso mais consistente no frontend
- alertas mais úteis e priorizados
- agrupamento por severidade
- leitura/não leitura melhor explorada
- integração mais visível com governança, financeiro e operação

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
- [~] cliente cria, edita e sustenta agenda / OS / cobrança
- [~] agendamento confirma e cancela; remarcação e lembrete ainda faltam
- [~] OS cria, executa, conclui e registra evento
- [~] cobrança nasce com base automática e também manual
- [~] pagamento fecha parte importante do ciclo corretamente
- [~] timeline registra eventos críticos
- [~] risco recalcula com coerência
- [~] governança reage com clareza

## Auth
- [x] login
- [x] registro
- [x] sessão
- [x] logout
- [~] forgot password
- [~] reset password
- [~] proteção de rota
- [~] permissões por role no frontend

## Customers
- [x] listagem
- [x] criação
- [x] edição
- [ ] dados completos
- [~] timeline por cliente
- [~] workspace operacional por cliente
- [ ] histórico de contato

## Appointments
- [x] criação
- [~] confirmação
- [ ] remarcação
- [~] cancelamento
- [ ] lembrete
- [x] vínculo com cliente

## Service Orders
- [x] criação
- [~] atualização de status
- [~] início de execução
- [~] conclusão
- [~] vínculo com cobrança
- [~] timeline operacional

## Finance
- [x] criação de cobrança
- [x] listagem
- [~] cobrança vencida
- [~] pagamento
- [~] atualização de status
- [~] comunicação financeira

## WhatsApp
- [~] envio manual
- [~] envio automático por eventos
- [ ] templates
- [ ] status de entrega
- [ ] retry
- [~] registro na timeline

## Controle operacional
- [~] timeline funcionando
- [~] risco recalculando
- [~] governança reagindo
- [ ] alertas aparecendo

---

# 8. PRÓXIMO FOCO RECOMENDADO

## Ordem sugerida
1. auth
2. appointments
3. service orders
4. finance
5. customers
6. whatsapp
7. timeline
8. risk
9. governance
10. settings / plans / billing / reports

## Justificativa da ordem
Hoje o maior ganho está em fechar melhor o fluxo principal já existente.  
Customers já tem base boa.  
O gargalo mais sensível está na costura:

agendamento  
→ ordem de serviço  
→ cobrança  
→ pagamento  
→ comunicação  
→ histórico visível

---

# 9. CRITÉRIO DE PRONTO POR FLUXO

## Auth pronto
- usuário entra
- usuário sai
- sessão persiste certo
- sessão expira sem quebrar UI
- erro de login aparece limpo
- recuperação de senha funciona do começo ao fim
- frontend respeita permissões reais por papel

## Customer pronto
- cliente nasce limpo
- cliente edita limpo
- cliente aparece onde precisa aparecer
- cliente sustenta agendamento, OS e cobrança
- workspace mostra histórico realmente útil

## Appointment pronto
- agenda cria
- agenda lista
- agenda atualiza
- agenda confirma e cancela bem
- agenda remarca com clareza
- agenda prepara comunicação

## Service Order pronta
- OS nasce
- OS executa
- OS conclui
- OS registra evento
- OS prepara financeiro
- OS mostra claramente o fechamento operacional

## Finance pronto
- cobrança nasce
- cobrança muda de status
- pagamento fecha ciclo
- histórico financeiro bate com operação
- evento financeiro repercute em timeline e comunicação

## WhatsApp pronto
- mensagem sai com contexto
- evento relevante pode disparar mensagem
- histórico fica rastreável
- falha fica visível
- status de entrega fica consultável

---

# 10. OBSERVAÇÕES TÉCNICAS QUE MERECEM REVISÃO

Alguns pontos do código merecem revisão por possível inconsistência de modelagem operacional:

- tipo de notificação de cobrança criada ainda parece usar evento inadequado em pelo menos um ponto
- alguns vínculos de entidade em lembrete financeiro merecem validação
- ainda falta confirmar se todos os disparos automáticos estão ficando realmente rastreáveis no produto

Esses pontos não anulam o avanço atual.  
Mas precisam entrar no pente-fino antes de considerar o fluxo “vendável sem susto”.

---

# 11. FRASE-GUIA

O NexoGestão não precisa parecer enorme.

Ele precisa parecer inevitável para a operação.

Menos expansão lateral.  
Mais fluxo completo.

Menos “já temos backend pra isso”.  
Mais “o usuário conseguiu usar até o fim”.
