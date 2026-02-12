# AutoEscola-Sim — Checklist MV1

## Front (apps/web)
- [ ] Rotas: `/`, `/simulado`, `/resultado`
- [ ] Estado do simulado (lista de perguntas, índice, progresso)
- [ ] Feedback por questão (acerto/erro) + XP incremental
- [ ] Tela de Resultado (acertos/erros, XP, ações)
- [ ] Serviço API (GET /questions, POST/PATCH /attempts)
- [ ] Guard de rota e reset de sessão
- [ ] Tokens de design + ícones padronizados

## Back (apps/api)
- [ ] Modelos Prisma: User, Question, Answer, Attempt, AttemptAnswer
- [ ] Seed inicial (≥100 perguntas, 3 categorias)
- [ ] Endpoints: healthz, questions (rand/limit), attempts (start/submit)
- [ ] DTOs + validação
- [ ] CORS para http://localhost:5173

## Infra
- [ ] .env (API, WEB)
- [ ] docker-compose (Postgres, pgAdmin)
- [ ] Scripts: lint, typecheck, prisma:studio

## Qualidade
- [ ] Commit Template (conventional)
- [ ] PR Template com checklist
- [ ] Hooks (lint-staged, prettier) — opcional
