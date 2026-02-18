# NexoGestão — Plataforma Modular de Gestão Operacional

O **NexoGestão** é uma plataforma de gestão modular com integração via WhatsApp,
focada em organizar operação, reduzir erro humano e automatizar comunicação.

Ele conecta:

cliente → operação → financeiro → execução → risco → histórico

Sem planilhas paralelas.  
Sem mensagem perdida.  
Sem controle informal.

---

## 🎯 Propósito

Pequenas e médias empresas não quebram por falta de cliente.

Quebram por desorganização operacional.

O NexoGestão existe para:

- Organizar operação
- Padronizar execução
- Automatizar comunicação
- Reduzir risco humano
- Registrar histórico real

Ele transforma rotina desorganizada em sistema estruturado.

---

## 🧠 Conceito Central

O NexoGestão não é um ERP pesado.

Ele é um núcleo inteligente (NexoCore) com módulos conectados.

Tudo gira em torno da operação real da empresa.

---

## 🏗 Estrutura Modular

### 👥 Módulo Clientes
- Cadastro completo
- Histórico de atendimento
- Relacionamento centralizado
- Status ativo/inativo

---

### 📅 Módulo Agenda
- Agendamentos
- Lembretes automáticos
- Confirmação via WhatsApp
- Controle de comparecimento

---

### 🧾 Módulo Ordens de Serviço
- Criação de O.S.
- Registro de execução
- Status da ordem
- Histórico por cliente

---

### 💰 Módulo Financeiro
- Registro de cobranças
- Controle de pagamento
- Envio automático de lembrete
- Emissão de recibo digital

---

### 📦 Módulo Estoque (fase futura)
- Controle de itens
- Baixa automática por O.S.
- Histórico de consumo

---

## 📲 Integração WhatsApp — "Meu Acessor"

O WhatsApp não é suporte.
É canal operacional.

Funções previstas:

- Confirmação de agendamento
- Envio de recibo
- Envio de link de pagamento
- Lembrete de pagamento não agressivo
- Confirmação de execução
- Token de acesso único

Comunicação automatizada, mas editável.

---

## 🧠 Núcleo Inteligente — NexoCore

O NexoCore é o diferencial invisível.

Ele calcula:

- Risco operacional por cliente
- Risco por colaborador
- Risco por atraso
- Frequência de falhas
- Indicadores de recorrência

Isso permite:

- Alertas automáticos
- Ajuste de prioridade
- Decisão baseada em dados

---

## 🔁 Fluxo Operacional

Cliente
→ Agenda
→ Ordem de Serviço
→ Execução
→ Financeiro
→ Comunicação automática
→ Histórico
→ Risco recalculado


Sem planilha paralela.
Sem controle fora do sistema.

---

## 🎯 Público-Alvo Inicial

Empresas de serviço:

- Limpeza
- Manutenção
- Assistência técnica
- Pequenas clínicas
- Escritórios
- Prestadores recorrentes

Negócios que vivem no WhatsApp e planilha.

---

## 🏗 Arquitetura Técnica

Monorepo:

apps/
api/ → NestJS + Prisma + PostgreSQL
web/ → React + Vite + Tailwind


Infra:

- Docker Compose
- PostgreSQL 15
- Seeds idempotentes
- Backend como autoridade
- Multi-tenant

---

## 🚀 Rodar Localmente

### Instalar dependências

```bash
pnpm install
