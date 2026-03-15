# O QUE FALTA NO NexoGestão
## Auditoria funcional real para fechar gaps de produto
**Análise:** 14/03/2026  
**Status:** revisão orientada a produção  
**Objetivo:** identificar o que ainda impede o NexoGestão de operar como produto coerente, utilizável e vendável

---

# 1. CONTEXTO

O NexoGestão já possui uma base arquitetural forte.

O fluxo estrutural oficial do sistema é:

cliente  
→ agendamento  
→ ordem de serviço  
→ execução  
→ cobrança  
→ pagamento  
→ histórico operacional  
→ análise de risco  
→ governança operacional

Ou seja: o produto já tem espinha dorsal clara.

O que falta agora não é mais “inventar módulo”.
O que falta é **fechar ciclo**, **eliminar buraco funcional** e **fazer backend + frontend + operação falarem a mesma língua**.

---

# 2. RESUMO EXECUTIVO

## Estado atual
A base técnica do sistema está boa.
Os módulos centrais existem.
O backend está mais limpo.
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
O risco é ficar com cara de sistema grande, mas com fluxo quebrado no uso real.

---

# 3. ORDEM DE PRIORIDADE REAL

## P0 — Fechar fluxo operacional central
Precisamos garantir que o fluxo principal funcione sem gambiarra:

cliente  
→ agendamento  
→ ordem de serviço  
→ execução  
→ cobrança  
→ pagamento  
→ timeline  
→ risco  
→ governança

Se esse ciclo não estiver sólido, o resto vira enfeite caro.

## P1 — Fechar integrações críticas de produto
Prioridade imediata:

- auth
- customers
- appointments
- service orders
- finance
- whatsapp

## P2 — Expor o que já existe no backend mas ainda está subutilizado
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

## P3 — Só depois ampliar inteligência, analytics e automação avançada
Antes disso, seria perfumaria com diploma.

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
Schema, migration, convites, seeds e guards já foram alinhados para esse novo modelo.

## O que ainda falta
- fluxo robusto de recuperação de senha realmente funcionando ponta a ponta
- confirmação de email
- tratamento de erros mais consistente
- proteção de rotas mais explícita no frontend
- controle melhor de estados de loading e sessão expirada
- política clara de papéis e permissões por tela no frontend
- alinhar definitivamente frontend e backend no consumo de roles e permissões

## Impacto
Sem isso, a entrada no sistema funciona, mas ainda não transmite produto maduro.

## Prioridade
P0

---

# 4.2 CUSTOMERS

## Situação atual
Clientes já existem como entidade central do sistema.
O modelo operacional oficial coloca Customer como base do relacionamento comercial.

## O que ainda falta
- endereço completo estruturado
- histórico de contato
- notas operacionais úteis
- visualização mais rica do workspace do cliente
- timeline de cliente integrada de forma forte no frontend
- padronização de filtros e busca
- estados mais claros de cliente ativo/inativo
- preparação para múltiplos serviços por cliente

## Gap principal
Hoje cliente existe.
Mas ainda não está plenamente tratado como “centro da operação”.

## Impacto
Isso afeta agendamento, cobrança, comunicação e histórico.

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
- status operacional mais claros
- integração melhor com comunicação

## Gap principal
O agendamento existe como registro.
Ainda precisa virar um fluxo operacional confiável.

## Impacto
Sem isso, agenda vira só tabela bonitinha com cosplay de controle.

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
- eventual suporte a anexos e evidências futuras

## Gap principal
A OS já existe, mas ainda precisa ser a “unidade real de execução” do produto.

## Impacto
Sem isso, o sistema controla cadastro, mas não controla bem a entrega.

## Prioridade
P0

---

# 4.5 FINANCE

## Situação atual
O sistema financeiro oficial gira em torno de Charge e Payment.
Esse fluxo está definido na arquitetura e no documento financeiro.

## O que ainda falta
- pagamento realmente integrado e fluindo bem no produto
- fechamento completo cobrança → pagamento → atualização de status
- geração automática de cobrança após conclusão de serviço
- visão mais forte por cliente
- mais consistência entre charges, invoices, launches e expenses
- dashboard financeiro mais operacional
- lembretes automáticos de cobrança
- confirmação automática de pagamento em timeline e comunicação
- futura camada de billing SaaS separada do financeiro operacional

## Gap principal
O financeiro existe, mas ainda está parcialmente fragmentado entre módulos.

## Impacto
É um dos pontos mais críticos porque encosta diretamente em receita.

## Prioridade
P0

---

# 4.6 WHATSAPP

## Situação atual
A comunicação operacional é pilar oficial do sistema.
O WhatsApp é o canal principal definido na documentação.
A proposta do sistema é comunicação contextual vinculada a eventos operacionais.
O módulo já está alinhado ao novo modelo de papéis no backend, mas ainda precisa fechar o fluxo operacional completo.

## O que ainda falta
- envio automático realmente amarrado a eventos
- templates padronizados por tipo
- confirmação de agendamento automática
- lembrete de serviço
- envio de link de pagamento
- confirmação de pagamento
- tratamento de falhas e retry
- histórico melhor por entidade operacional
- status de entrega mais confiável
- integração sólida com timeline

## Gap principal
Hoje o WhatsApp tende a existir mais como capacidade técnica do que como motor operacional fechado.

## Impacto
Esse módulo é diferencial comercial.
Se estiver meia-bomba, o produto perde força de venda.

## Prioridade
P0

---

# 5. GAPS TRANSVERSAIS

---

# 5.1 TIMELINE

## Situação atual
A timeline é fonte oficial de histórico operacional.
Ela deve registrar eventos centrais do sistema.

## O que ainda falta
- uso mais forte no frontend
- visualização por cliente
- visualização por ordem de serviço
- visualização financeira
- filtros por tipo de evento
- consistência de metadados
- garantia de que eventos críticos estão sendo gerados em todos os fluxos principais

## Gap principal
A timeline é central na arquitetura, mas ainda não está explorada no produto na mesma proporção.

## Prioridade
P1

---

# 5.2 RISK ENGINE

## Situação atual
O motor de risco é um dos diferenciais centrais do NexoGestão.
Ele já faz parte da visão oficial da plataforma.

## O que ainda falta
- tornar o risco mais visível no frontend operacional
- explicar claramente por que o risco mudou
- ligar eventos operacionais ao score de forma mais transparente
- exibir histórico de risco
- tornar o impacto do risco mais acionável para o usuário

## Gap principal
O risco já existe como inteligência interna.
Ainda precisa aparecer como valor prático para a operação.

## Prioridade
P1

---

# 5.3 GOVERNANÇA

## Situação atual
Governança é pilar oficial da plataforma.
Já existe conceito de execução de governança, políticas e enforcement.

## O que ainda falta
- experiência mais clara para leitura de execuções
- maior ligação com alertas operacionais
- explicação das decisões tomadas
- exibição melhor das transições de estado operacional
- visão administrativa mais forte
- correlação mais clara com risco e timeline

## Gap principal
A governança existe.
Mas ainda precisa parecer menos “coisa interna do sistema” e mais “controle útil para o gestor”.

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

## Gap principal
Sem auditoria robusta, o sistema perde força institucional e maturidade.

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

# 6. MÓDULOS DO BACKEND QUE PARECEM SUBUTILIZADOS PELO WEB

Esses módulos existem ou estão registrados na arquitetura/plataforma, mas ainda não parecem explorados como deveriam no produto final:

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
backend rico + frontend magro = produto com potencial alto e percepção baixa.

---

# 7. O QUE FALTA PARA FICAR “VENDA REAL”

## Falta fechar estes ciclos de forma impecável:

### 7.1 Ciclo operacional base
- criar cliente
- agendar
- gerar OS
- executar
- cobrar
- receber
- registrar histórico

### 7.2 Ciclo de comunicação
- confirmar
- lembrar
- cobrar
- avisar
- registrar entrega/falha

### 7.3 Ciclo de controle
- registrar evento
- recalcular risco
- atualizar governança
- notificar responsável

### 7.4 Ciclo administrativo
- autenticar
- definir permissão
- configurar organização
- consultar histórico
- analisar operação

---

# 8. O QUE NÃO É PRIORIDADE AGORA

Não é hora de abrir mais frente antes de fechar produto base.

## Segurar por enquanto:
- múltiplos canais além do WhatsApp
- analytics rebuscado demais
- automação mega configurável
- inteligência preditiva sofisticada
- upload de arquivos avançado
- integrações externas demais
- relatórios super complexos
- machine learning e foguete de Marte

Primeiro o arroz.
Depois a nave espacial.

---

# 9. CHECKLIST EXECUTÁVEL DE PRÓXIMA AUDITORIA

## Backend vs frontend
- [ ] mapear todas as rotas consumidas pelo frontend
- [ ] mapear rotas existentes no backend sem uso no web
- [ ] validar consistência de payloads
- [ ] validar erros e retornos padronizados

## Fluxo auth
- [ ] login
- [ ] registro
- [ ] sessão
- [ ] logout
- [ ] forgot password
- [ ] reset password
- [ ] proteção de rota
- [ ] alinhamento completo de permissões por role no frontend

## Fluxo customers
- [ ] listagem
- [ ] criação
- [ ] edição
- [ ] dados completos
- [ ] timeline por cliente
- [ ] histórico de contato

## Fluxo appointments
- [ ] criação
- [ ] confirmação
- [ ] remarcação
- [ ] cancelamento
- [ ] lembrete
- [ ] vínculo com cliente

## Fluxo service orders
- [ ] criação
- [ ] atualização de status
- [ ] início de execução
- [ ] conclusão
- [ ] vínculo com cobrança
- [ ] timeline operacional

## Fluxo financeiro
- [ ] criação de cobrança
- [ ] listagem
- [ ] cobrança vencida
- [ ] pagamento
- [ ] atualização de status
- [ ] comunicação financeira

## Fluxo WhatsApp
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

# 10. DEFINIÇÃO HONESTA DO MOMENTO ATUAL

O NexoGestão já tem cara de plataforma.

Mas para virar produto operacional forte de verdade, ainda precisa:

- fechar os ciclos principais
- reduzir lacunas entre backend e frontend
- tornar comunicação e financeiro realmente confiáveis
- expor melhor risco, timeline e governança
- transformar módulos existentes em valor visível para o usuário

---

# 11. CONCLUSÃO

A fase de “limpar entulho” já avançou bastante.

Agora a meta correta é:

**parar de expandir lateralmente**
e
**começar a fechar verticalmente**

Ou seja:

menos módulo novo  
mais fluxo completo

menos promessa  
mais operação funcionando de ponta a ponta

menos “já temos backend pra isso”  
mais “o usuário realmente consegue usar isso até o fim”

---

# 12. PRÓXIMO FOCO RECOMENDADO

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

# 13. FRASE-GUIA DO PRODUTO

O NexoGestão não precisa parecer enorme.

Ele precisa parecer inevitável para a operação.

Quando cliente, agenda, execução, cobrança, pagamento, comunicação, risco e governança fluírem sem atrito, aí sim a plataforma vira bicho de verdade.

---

# 14. P0 IMEDIATO — PRÓXIMA RODADA DE EXECUÇÃO

## Objetivo
Fechar o ciclo principal do produto com o menor número possível de lacunas visíveis para operação real.

## Ordem prática de ataque

### P0.1 Auth
**Meta:** autenticação sem fricção e sem buraco de sessão

**Revisar:**
- `apps/web/client/src/contexts/AuthContext.tsx`
- `apps/web/client/src/pages/Login.tsx`
- `apps/web/client/src/pages/Register.tsx`
- `apps/web/client/src/pages/ForgotPasswordPage.tsx`
- `apps/web/client/src/pages/ResetPasswordPage.tsx`
- `apps/web/server/routers/nexo-proxy.ts`
- `apps/api/src/auth/*`

**Pronto quando:**
- login funcionar sem estado inconsistente
- logout limpar sessão corretamente
- rota protegida não vazar
- recuperação de senha tiver fluxo real ou ficar explicitamente desativada no produto
- permissões por tela respeitarem o novo modelo de roles

---

### P0.2 Customers
**Meta:** cliente virar centro operacional real

**Revisar:**
- `apps/web/client/src/pages/CustomersPage.tsx`
- `apps/web/server/routers/nexo-proxy.ts`
- `apps/api/src/customers/*`
- `apps/api/src/timeline/*`
- `apps/api/src/whatsapp/*`

**Pronto quando:**
- criar, editar e listar cliente funcionar sem ruído
- cliente tiver dados realmente úteis para operação
- ações posteriores do sistema conseguirem partir do cliente sem remendo

---

### P0.3 Appointments
**Meta:** agenda confiável, não só cadastro de horário

**Revisar:**
- `apps/web/client/src/pages/AppointmentsPage.tsx`
- `apps/api/src/appointments/*`
- `apps/api/src/customers/*`
- `apps/api/src/whatsapp/*`
- `apps/api/src/timeline/*`

**Pronto quando:**
- criar e listar agendamento funcionar bem
- status fizer sentido
- cliente vinculado corretamente
- base pronta para confirmação e lembrete

---

### P0.4 Service Orders
**Meta:** OS virar núcleo real de execução

**Revisar:**
- `apps/web/client/src/pages/ServiceOrdersPage.tsx`
- `apps/api/src/service-orders/*`
- `apps/api/src/execution/*`
- `apps/api/src/timeline/*`
- `apps/api/src/risk/*`

**Pronto quando:**
- OS puder ser criada, iniciada, concluída e visualizada sem ambiguidade
- execução alterar estado de forma coerente
- conclusão preparar terreno para cobrança

---

### P0.5 Finance
**Meta:** cobrança e pagamento fecharem ciclo de receita

**Revisar:**
- `apps/web/client/src/pages/FinancesPage.tsx`
- `apps/web/client/src/pages/ExpensesPage.tsx`
- `apps/web/client/src/pages/InvoicesPage.tsx`
- `apps/web/client/src/pages/LaunchesPage.tsx`
- `apps/api/src/finance/*`
- `apps/api/src/payments/*`
- `apps/api/src/invoices/*`
- `apps/api/src/expenses/*`
- `apps/api/src/launches/*`

**Pronto quando:**
- cobrança for criada corretamente
- status financeiro fizer sentido
- pagamento atualizar o ciclo
- operação enxergar o que recebeu, o que falta e o que venceu

---

### P0.6 WhatsApp
**Meta:** comunicação operacional real, não módulo decorativo

**Revisar:**
- `apps/web/client/src/pages/WhatsAppPage.tsx`
- `apps/api/src/whatsapp/*`
- `apps/api/src/notifications/*`
- `apps/api/src/timeline/*`
- `apps/api/src/service-orders/*`
- `apps/api/src/appointments/*`
- `apps/api/src/finance/*`

**Pronto quando:**
- mensagens puderem ser enviadas com contexto
- eventos importantes prepararem comunicação
- histórico fizer sentido
- falhas não sumirem no vazio

---

# 15. CRITÉRIO DE PRONTO POR FLUXO

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

# 16. PERGUNTA-MESTRE PARA CADA MÓDULO

Antes de mexer em qualquer área, responder:

**isso aqui fecha um fluxo real de operação ou só aumenta volume de sistema?**

Se fechar fluxo, continua.  
Se só aumentar volume, segura.

---

# 17. PRÓXIMA SAÍDA ESPERADA DA AUDITORIA

Depois da próxima revisão técnica, o ideal é gerar um novo documento com este formato:

- rotas backend usadas pelo frontend
- rotas backend sem uso
- páginas com fluxo completo
- páginas com fluxo parcial
- TODOs críticos de produto
- P0 fechado
- P1 pendente
- decisão do que não entra agora
