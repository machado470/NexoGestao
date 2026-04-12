# NexoGestão — Plataforma Modular de Gestão Operacional

O **NexoGestão** é uma plataforma de gestão modular com integração via WhatsApp, focada em organizar a operação, reduzir erros humanos e automatizar a comunicação. Ele conecta cliente → operação → financeiro → execução → risco → histórico, eliminando planilhas paralelas e controles informais.

---

## 🎯 Propósito

Pequenas e médias empresas quebram por desorganização operacional, não por falta de cliente. O NexoGestão existe para:

- Organizar a operação
- Padronizar a execução
- Automatizar a comunicação
- Reduzir o risco humano
- Registrar o histórico real

Ele transforma rotinas desorganizadas em um sistema estruturado.

---

## 🧠 Conceito Central

O NexoGestão não é um ERP pesado. Ele é um núcleo inteligente (NexoCore) com módulos conectados, onde tudo gira em torno da operação real da empresa.

---

## 🏗 Estrutura Modular

### 👥 Módulo Clientes
Cadastro completo com histórico de atendimento e relacionamento centralizado.

### 📅 Módulo Agenda
Agendamentos com controle de status, notas e comparecimento.

### 🧾 Módulo Ordens de Serviço
Criação e registro de O.S. com status, prioridade e histórico por cliente.

### 💰 Módulo Financeiro
Registro de cobranças, controle de pagamento, rastreamento de valores e histórico de transações.

### 📲 Integração WhatsApp — "Meu Acessor"
Visualização de conversas, envio de mensagens, rastreamento de status e histórico de contatos, tudo integrado aos dados do cliente. Comunicação automatizada, mas editável.

### 👥 Módulo Pessoas
Cadastro de colaboradores, atribuição de tarefas e histórico de atividades.

### 🛡️ Módulo Governança
Auditoria de operações, rastreamento de mudanças e relatórios de conformidade.

---

## 🔁 Fluxo Operacional

Cliente → Agenda → Ordem de Serviço → Execução → Financeiro → Comunicação automática (WhatsApp) → Histórico → Risco recalculado.

Sem planilha paralela. Sem controle fora do sistema.

---

## 🎯 Público-Alvo Inicial

Empresas de serviço como limpeza, manutenção, assistência técnica, pequenas clínicas, escritórios e prestadores recorrentes. Negócios que vivem no WhatsApp e planilhas.

---

## 🚀 CI/CD

Os workflows de CI/CD para Staging e Produção foram configurados no GitHub Actions. O deploy para Staging é acionado automaticamente em pushes para a branch `development`, enquanto o deploy para Produção é acionado em pushes para a branch `main`.

---

## 📊 Status Atual

O NexoGestão está em desenvolvimento ativo, com as funcionalidades principais implementadas e em fase de refinamento. Os workflows de CI/CD estão configurados para garantir a entrega contínua.

---

**Última atualização:** 2026-03-05

---

## 🧪 Execução local real (Postgres + Redis)

1. Copie variáveis padrão:

```bash
cp .env.example .env
```

2. Primeira subida limpa (recomendada quando já houve `docker run` manual):

```bash
pnpm dev:full --clean
```

> Alternativa equivalente: `DEV_FULL_CLEAN=1 pnpm dev:full`

3. Execução normal (idempotente e com reaproveitamento automático):

```bash
pnpm dev:full
```

Fluxo atual do `dev:full`:
- verifica portas críticas (`5432`, `6379`, `3000`, `3010`);
- detecta e reaproveita containers Nexo legados/compose (`nexogestao-postgres`, `nexogestao-redis`, `nexogestao_postgres`, `nexogestao_redis`);
- recria apenas o que estiver faltando (ou tudo no modo `--clean`);
- falha com mensagem objetiva quando a porta está ocupada por processo/container externo;
- valida saúde de Postgres/Redis antes de seguir para migrations, seed, API e Web.

4. Em outro terminal, execute os testes de integração com infra real:

```bash
pnpm --filter ./apps/api exec jest test/integration --runInBand
```

Checklist manual completa em `docs/REAL_VALIDATION_CHECKLIST.md`.
