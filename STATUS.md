NexoGestão
Plataforma Modular de Gestão Operacional

O NexoGestão é uma plataforma modular de gestão operacional com integração via WhatsApp, focada em organizar operação, reduzir erro humano e automatizar comunicação.

Ele conecta:

cliente → operação → financeiro → execução → risco → histórico

Sem planilhas paralelas.
Sem mensagem perdida.
Sem controle informal.

🎯 Propósito

Pequenas e médias empresas não quebram por falta de cliente.

Elas quebram por:

desorganização

falha de execução

cobrança mal controlada

comunicação perdida

histórico inexistente

O NexoGestão existe para transformar rotina improvisada em sistema estruturado.

Ele organiza:

operação

comunicação

cobrança

execução

risco

histórico

E faz isso sem virar um ERP pesado e burocrático.

🧠 Conceito Central

O NexoGestão não é um ERP tradicional.

Ele é um núcleo inteligente (NexoCore) com módulos conectados.

Cada módulo resolve uma parte da operação real.
O núcleo conecta tudo e gera inteligência.

Tudo gira em torno da execução real da empresa.

🏗 Estrutura Modular
👥 Módulo Clientes

Cadastro completo

Histórico por cliente

Status ativo / inativo

Relação com O.S., financeiro e agenda

Indicadores de recorrência

Cliente deixa de ser contato solto.
Vira entidade operacional.

📅 Módulo Agenda

Criação de agendamentos

Status (confirmado / pendente / cancelado)

Lembretes automáticos

Confirmação via WhatsApp

Controle de comparecimento

Agenda não é calendário.
É controle de presença.

🧾 Módulo Ordens de Serviço

Criação de O.S.

Registro de execução

Status (aberta / em execução / concluída)

Histórico por cliente

Registro de responsável

Execução deixa rastro.

💰 Módulo Financeiro

Registro de cobrança

Controle de pagamento

Status (pendente / pago / atrasado)

Envio automático de lembrete

Emissão de recibo digital

Integração com link de pagamento

Cobrança deixa de ser improviso.

📦 Módulo Estoque (fase futura)

Controle de itens

Baixa automática por O.S.

Histórico de consumo

Relatório por período

📲 Integração WhatsApp — "Meu Acessor"

WhatsApp não é suporte.
É canal operacional.

Funções previstas:

Confirmação automática de agendamento

Envio de recibo

Envio de link de pagamento

Lembrete de pagamento não agressivo

Confirmação de execução

Token de acesso único

Comunicação automática editável

Sem copiar e colar.
Sem esquecer mensagem.

🧠 Núcleo Inteligente — NexoCore

O diferencial invisível.

O NexoCore calcula:

Risco operacional por cliente

Risco por colaborador

Risco por atraso

Frequência de falhas

Reincidência de inadimplência

Taxa de comparecimento

Com base nisso o sistema pode:

Priorizar atendimento

Gerar alerta interno

Ajustar cobrança

Sugerir ação preventiva

Elevar nível de risco

Não é só registro.
É decisão baseada em padrão.

🔁 Fluxo Operacional Padrão

Cliente
→ Agenda
→ Ordem de Serviço
→ Execução
→ Financeiro
→ Comunicação automática
→ Histórico
→ Risco recalculado

Nada acontece fora do sistema.

Se não está no sistema, não aconteceu.

🎯 Público-Alvo Inicial

Empresas de serviço que vivem no WhatsApp e planilha:

Limpeza

Manutenção

Assistência técnica

Pequenas clínicas

Escritórios

Prestadores recorrentes

Negócios locais

O foco inicial é organização operacional simples com inteligência real.

🏗 Arquitetura Técnica

Monorepo:

apps/api
→ NestJS
→ Prisma
→ PostgreSQL

apps/web
→ React
→ Vite
→ Tailwind

Infra:

Docker Compose

PostgreSQL 15

Seeds idempotentes

Backend como autoridade

Multi-tenant

Logs auditáveis

🔒 Princípios Técnicos

Backend define regra

Seeds idempotentes

Jobs idempotentes

Multi-tenant isolado

Sem dado fake para demo

Estado derivado, não manual

Histórico persistido

🚀 Rodar Localmente

Instalar dependências:

pnpm install


Subir ambiente:

docker compose up --build


API disponível em:

http://localhost:3000

📌 Fases do Projeto

Fase 1 — Base Operacional
Clientes + Agenda + O.S. + Financeiro

Fase 2 — Integração WhatsApp
Automação de mensagens + tokens

Fase 3 — NexoCore Inteligente
Cálculo de risco operacional

Fase 4 — Produto Comercial
Planos + painel administrativo + piloto real

🧭 Posicionamento Estratégico

O NexoGestão não compete com ERP gigante.

Ele resolve o caos operacional do pequeno e médio negócio.

É leve.
É direto.
É automatizado.
É inteligente.

Ele transforma:

desorganização → processo
processo → histórico
histórico → risco
risco → decisão