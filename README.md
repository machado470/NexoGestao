# JurisFlow — Risk & Compliance Engine

Sistema de gestão de risco humano, treinamento por trilhas e auditoria contínua
para ambientes profissionais (jurídico, compliance, operações).

Este projeto evoluiu a partir do AutoEscola-Sim e hoje funciona como um
motor genérico de avaliação, risco e ações corretivas.

---

## 🧠 O que o sistema faz

- Gerencia **pessoas** (Person / User)
- Atribui **trilhas de treinamento** (Tracks)
- Avalia desempenho por **assignments e assessments**
- Calcula **risco agregado**
- Registra **eventos e auditoria**
- Cria e acompanha **ações corretivas**
- Gera **relatórios de risco**


## 🧩 Arquitetura

### Backend (NestJS + Prisma)
- Persons / People
- Assignments / Assessments
- Risk Engine
- Audit & Events
- Corrective Actions
- Reports

### Frontend (React)
- Admin Dashboard
- Gestão de Pessoas
- Trilhas
- Auditoria
- Relatórios

---

## ▶️ Execução (desenvolvimento)

```bash
pnpm dev:api
pnpm dev:web
