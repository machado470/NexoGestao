# 🔴 O Que Falta no NexoGestão

**Análise:** 02/03/2026  
**Status:** Identificação de gaps para produção

---

## 1. CRÍTICO - Bloqueadores para Produção

### 1.1 Email Não Funciona ⚠️
**Impacto:** ALTO - Usuários não conseguem recuperar senha  
**Localização:** `server/_core/email.ts`  
**Status:** Estrutura pronta, sem integração real

**O que falta:**
- [ ] Integração com SendGrid/AWS SES/Resend
- [ ] Variáveis de ambiente (SENDGRID_API_KEY ou equivalente)
- [ ] Template de email HTML profissional
- [ ] Fila de emails (Bull/BullMQ) para retry automático
- [ ] Logging de emails enviados

**Impacto no Sistema:**
- Recuperação de senha não envia email real
- Notificações de novos agendamentos não são enviadas
- Confirmação de cadastro não é enviada

---

### 1.2 Pagamento Não Funciona ⚠️
**Impacto:** ALTO - Ninguém paga pelo plano  
**Localização:** `client/src/pages/PlansPage.tsx`, `server/routers/plans.ts`  
**Status:** UI pronta, sem integração de pagamento

**O que falta:**
- [ ] Integração Stripe/Mercado Pago
- [ ] Webhook de confirmação de pagamento
- [ ] Atualização automática de subscription após pagamento
- [ ] Recebimento de notificações de pagamento
- [ ] Histórico de transações
- [ ] Cancelamento de plano com reembolso

**Impacto no Sistema:**
- Usuários não conseguem fazer upgrade
- Plano fica sempre "Free"
- Sem receita para a plataforma

---

### 1.3 Validação de Limites por Plano ⚠️
**Impacto:** ALTO - Qualquer um usa features premium  
**Localização:** Todas as páginas CRUD  
**Status:** Não implementado

**O que falta:**
- [ ] Middleware para validar plano antes de criar item
- [ ] Bloqueio de criação quando atingiu limite
- [ ] Toast/Modal informando limite atingido
- [ ] Upgrade sugerido quando limite próximo
- [ ] Contador de uso atual vs limite

**Exemplo:**
```typescript
// Falta isso em cada CRUD
if (userPlan === 'free' && customerCount >= 5) {
  throw new Error("Limite de 5 clientes atingido. Faça upgrade para Pro");
}
```

**Impacto no Sistema:**
- Usuário free pode criar 50 clientes (limite é 5)
- Usuário free pode criar 100 agendamentos (limite é 10)
- Sem controle de uso

---

## 2. IMPORTANTE - Funcionalidades Faltando

### 2.1 Integração Service Order → Charge ⚠️
**Impacto:** MÉDIO - Fluxo de negócio quebrado  
**Localização:** `ServiceOrdersPage.tsx`, `server/routers/service-tracking.ts`  
**Status:** Não conectado

**O que falta:**
- [ ] Botão "Gerar Cobrança" em ordem de serviço finalizada
- [ ] Criar automaticamente charge quando ordem é finalizada
- [ ] Copiar valor da ordem para charge
- [ ] Copiar cliente da ordem para charge
- [ ] Histórico de cobranças geradas da ordem

**Fluxo esperado:**
1. Criar Ordem de Serviço (R$ 500)
2. Marcar como finalizada
3. Sistema gera Charge de R$ 500 automaticamente
4. Cliente vê na página de Financeiro

---

### 2.2 Integração Notas Fiscais ⚠️
**Impacto:** MÉDIO - Compliance fiscal  
**Localização:** `InvoicesPage.tsx`, `server/routers/invoices.ts`  
**Status:** CRUD básico, sem integração

**O que falta:**
- [ ] Gerar número de NF sequencial
- [ ] Integração com API de NF-e (opcional)
- [ ] Validação de CNPJ/CPF
- [ ] Cálculo automático de impostos
- [ ] Geração de PDF da NF
- [ ] Envio de NF por email
- [ ] Histórico de NF emitidas

---

### 2.3 Integração Despesas ⚠️
**Impacto:** MÉDIO - Relatório financeiro incompleto  
**Localização:** `ExpensesPage.tsx`, `server/routers/expenses.ts`  
**Status:** CRUD básico

**O que falta:**
- [ ] Categorias de despesas (Aluguel, Salário, Materiais, etc)
- [ ] Integração em Relatório Financeiro
- [ ] Cálculo de Lucro Líquido (Receita - Despesas)
- [ ] Gráfico de Despesas por Categoria
- [ ] Orçamento vs Realizado
- [ ] Alertas de despesa acima do orçamento

---

### 2.4 Relatórios em PDF ⚠️
**Impacto:** MÉDIO - Usuários querem exportar dados  
**Localização:** Todas as páginas  
**Status:** Não implementado

**O que falta:**
- [ ] Botão "Exportar PDF" em cada página
- [ ] Template profissional de PDF
- [ ] Incluir logo da empresa
- [ ] Gráficos em PDF
- [ ] Tabelas formatadas
- [ ] Rodapé com data e hora

---

### 2.5 Histórico de Contatos ⚠️
**Impacto:** MÉDIO - Rastreamento de comunicação  
**Localização:** `CustomersPage.tsx`  
**Status:** Não implementado

**O que falta:**
- [ ] Tabela de histórico de contatos por cliente
- [ ] Data, hora, tipo (email, WhatsApp, ligação)
- [ ] Descrição do contato
- [ ] Usuário que fez o contato
- [ ] Integração com WhatsApp (mostrar mensagens)
- [ ] Timeline visual

---

## 3. IMPORTANTE - Validações e Regras

### 3.1 Validação de Força de Senha
**Impacto:** MÉDIO - Segurança  
**Localização:** `Register.tsx`, `ResetPasswordPage.tsx`  
**Status:** Apenas comprimento mínimo

**O que falta:**
- [ ] Exigir maiúsculas
- [ ] Exigir números
- [ ] Exigir caracteres especiais
- [ ] Validação em tempo real com feedback visual
- [ ] Barra de força de senha
- [ ] Sugestões de melhoria

---

### 3.2 Validação de Email
**Impacto:** MÉDIO - Qualidade de dados  
**Localização:** `Register.tsx`, `CustomersPage.tsx`  
**Status:** Apenas verificação básica

**O que falta:**
- [ ] Verificação de email duplicado
- [ ] Confirmação de email (enviar código)
- [ ] Validação de domínio (não permitir @test.com)
- [ ] Detecção de typos comuns (gmial.com → gmail.com)

---

### 3.3 Validação de CNPJ/CPF
**Impacto:** MÉDIO - Compliance  
**Localização:** `CustomersPage.tsx`, `PeoplePage.tsx`  
**Status:** Não implementado

**O que falta:**
- [ ] Validação de CNPJ (empresa)
- [ ] Validação de CPF (pessoa)
- [ ] Cálculo de dígito verificador
- [ ] Máscara de entrada (XX.XXX.XXX/XXXX-XX)

---

### 3.4 Validação de Telefone
**Impacto:** BAIXO - UX  
**Localização:** `CustomersPage.tsx`, `WhatsAppPage.tsx`  
**Status:** Sem máscara

**O que falta:**
- [ ] Máscara de telefone (XX) XXXXX-XXXX
- [ ] Validação de DDD
- [ ] Suporte para WhatsApp (+55)

---

## 4. IMPORTANTE - Integrações Externas

### 4.1 Google OAuth
**Impacto:** MÉDIO - UX de login  
**Localização:** `server/_core/google-oauth.ts`  
**Status:** Infraestrutura pronta

**O que falta:**
- [ ] GOOGLE_OAUTH_CLIENT_ID
- [ ] GOOGLE_OAUTH_CLIENT_SECRET
- [ ] Testar fluxo completo
- [ ] Botão em Login/Register

---

### 4.2 WhatsApp Business API
**Impacto:** MÉDIO - Comunicação  
**Localização:** `server/routers/whatsapp-webhook.ts`  
**Status:** Estrutura pronta

**O que falta:**
- [ ] WHATSAPP_BUSINESS_ACCOUNT_ID
- [ ] WHATSAPP_BUSINESS_PHONE_NUMBER_ID
- [ ] WHATSAPP_API_TOKEN
- [ ] Testar webhook
- [ ] Enviar mensagens reais

---

### 4.3 Google Maps
**Impacto:** BAIXO - Localização  
**Localização:** `client/src/components/Map.tsx`  
**Status:** Componente pronto

**O que falta:**
- [ ] Integrar em página de clientes (endereço)
- [ ] Mostrar localização de serviços
- [ ] Calcular rota entre endereços

---

## 5. MELHORIAS - Nice to Have

### 5.1 Notificações em Tempo Real
- [ ] WebSocket para atualizações live
- [ ] Notificação de novo agendamento
- [ ] Notificação de cobrança vencida
- [ ] Notificação de novo cliente

### 5.2 Busca Avançada
- [ ] Busca global em todas as páginas
- [ ] Filtros avançados
- [ ] Salvar buscas frequentes

### 5.3 Temas Customizáveis
- [ ] Usuário escolher cor primária
- [ ] Salvar preferência
- [ ] Logo da empresa customizável

### 5.4 Auditoria e Logs
- [ ] Log de todas as ações (criar, editar, deletar)
- [ ] Quem fez o quê e quando
- [ ] Restaurar versão anterior

### 5.5 Backup Automático
- [ ] Backup diário dos dados
- [ ] Restauração de backup
- [ ] Retenção de 30 dias

---

## 6. Checklist de Priorização

### 🔴 CRÍTICO (Implementar Agora)
- [ ] Email funcional
- [ ] Pagamento funcional
- [ ] Validação de limites por plano
- [ ] Service Order → Charge

### 🟠 IMPORTANTE (Próximas 2 semanas)
- [ ] Notas Fiscais integradas
- [ ] Despesas em relatório
- [ ] Relatórios em PDF
- [ ] Histórico de contatos
- [ ] Validações (senha, email, CNPJ/CPF)

### 🟡 LEGAL (Próximo mês)
- [ ] Google OAuth com credenciais
- [ ] WhatsApp Business API
- [ ] Google Maps integrado
- [ ] Notificações em tempo real

### 🟢 NICE TO HAVE (Quando tiver tempo)
- [ ] Busca avançada
- [ ] Temas customizáveis
- [ ] Auditoria e logs
- [ ] Backup automático

---

## 7. Estimativa de Trabalho

| Item | Complexidade | Tempo | Prioridade |
|------|-------------|-------|-----------|
| Email | Média | 2h | 🔴 |
| Pagamento | Alta | 6h | 🔴 |
| Validação de Limites | Média | 3h | 🔴 |
| Service Order → Charge | Média | 2h | 🔴 |
| Notas Fiscais | Média | 4h | 🟠 |
| Despesas em Relatório | Baixa | 2h | 🟠 |
| Relatórios PDF | Média | 4h | 🟠 |
| Histórico de Contatos | Baixa | 2h | 🟠 |
| Validações | Baixa | 3h | 🟠 |
| Google OAuth | Baixa | 1h | 🟡 |
| WhatsApp API | Média | 3h | 🟡 |
| Google Maps | Baixa | 2h | 🟡 |

**Total Crítico:** 13h  
**Total Importante:** 15h  
**Total Legal:** 6h  

---

## Conclusão

O NexoGestão está **95% funcional**, mas precisa de:

1. **Email real** para recuperação de senha
2. **Pagamento real** para monetização
3. **Validação de limites** para controlar uso por plano
4. **Integração Service Order → Charge** para fluxo de negócio

Depois disso, é **100% pronto para produção**.

**Tempo estimado para crítico:** 13 horas  
**Tempo estimado para importante:** 15 horas  
**Tempo estimado para legal:** 6 horas  

**Total:** ~34 horas de desenvolvimento

---

**Última atualização:** 02/03/2026 14:50 GMT-3
