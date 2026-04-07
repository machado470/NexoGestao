# Checklist de Validação Real (sem mock)

> Pré-requisito: Docker ativo, portas 5432/6379 livres e `.env` criado a partir de `.env.example`.

## 1) Subir sistema completo
- [ ] Executar `pnpm install`
- [ ] Executar `pnpm dev:full`
- [ ] Confirmar logs da API:
  - [ ] `DB conectado (Prisma)`
  - [ ] `Redis conectado`
  - [ ] `Queue ativa`

## 2) Login
- [ ] Acessar Web em `http://localhost:3000`
- [ ] Realizar login com usuário válido
- [ ] Confirmar retorno para dashboard

## 3) Criar cliente
- [ ] Navegar para módulo de clientes
- [ ] Criar cliente com nome + telefone
- [ ] Confirmar cliente na listagem

## 4) Criar agendamento
- [ ] Criar agendamento para o cliente
- [ ] Definir data/hora futura
- [ ] Confirmar status inicial `SCHEDULED`

## 5) Gerar Ordem de Serviço (OS)
- [ ] Criar OS vinculada ao cliente/agendamento
- [ ] Iniciar execução
- [ ] Concluir execução
- [ ] Confirmar OS em `DONE`

## 6) Criar cobrança
- [ ] Criar cobrança vinculada à OS
- [ ] Confirmar cobrança em `PENDING`

## 7) Pagar cobrança
- [ ] Registrar pagamento (PIX/cartão)
- [ ] Confirmar cobrança em `PAID`
- [ ] Confirmar lançamento de pagamento no histórico

## 8) Validar timeline
- [ ] Abrir timeline do cliente/OS
- [ ] Confirmar eventos: criação, execução, cobrança, pagamento

## 9) Validar WhatsApp
- [ ] Confirmar criação de mensagens (agendamento/recibo)
- [ ] Validar status de envio/filas

## 10) Validar governança
- [ ] Consultar trilha de auditoria
- [ ] Confirmar ações com actor, entidade e timestamp
- [ ] Validar isolamento por organização (tenant)

## 11) Testes de integração com infra real
- [ ] Com `pnpm dev:full` ativo, em outro terminal executar:
  - `pnpm --filter ./apps/api exec jest test/integration --runInBand`
- [ ] Confirmar suíte verde sem `ECONNREFUSED`
