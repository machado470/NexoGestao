# NexoGestao — Governance & Risk Engine

O **NexoGestao** é um motor de governança operacional com trilhas de execução,
risco humano mensurável e auditoria contínua.

Ele existe para transformar “processo no PowerPoint” em mecanismo rodando de verdade.

Governança não é discurso.  
É execução rastreável.

---

## 🎯 Propósito

Organizações falham não por falta de regras,
mas por falta de execução consistente.

O NexoGestao fecha o ciclo:

trilha → execução → evidência → risco → ação corretiva → auditoria

Sem planilha paralela.  
Sem controle informal.  
Sem “ninguém viu”.

---

## 🧠 Conceitos Centrais

### Pessoas e papéis
Cada usuário opera dentro de um contexto organizacional definido.  
Permissões não são decorativas.

### Trilhas de execução
Conteúdos, rotinas e validações atribuídas conforme função, risco e histórico.

### Execução registrada
Nada avança sem evidência.  
Cada item gera registro.

### Risco humano
Recalculado automaticamente com base em:
- recorrência
- gravidade
- atrasos
- falhas

Risco não é opinião.

### Ações corretivas
Quando limites são ultrapassados, o sistema gera ações obrigatórias.

Governança que não age vira relatório.

### Auditoria contínua
Linha do tempo defensável de decisões, execuções e eventos críticos.

---

## 🏗 Arquitetura

Monorepo com:

- `apps/api` → NestJS + Prisma + PostgreSQL
- `apps/web` → React + Vite + Tailwind
- Docker Compose (API + Postgres)
- Seeds idempotentes
- Jobs idempotentes
- Backend como autoridade

Princípio inegociável:

> Nada de dados fake para demo.

---

## 🚀 Rodar localmente

### 1. Instalar dependências

```bash
pnpm install
