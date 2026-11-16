# Responsáveis operacionais e resultados do worker financeiro — 2026-11-09

Base: main `a4d1d28e486a5ba522fc5e87037ef8b2e5116a18`.

## Minimização de dados

GET /people/assignees usava a mesma consulta completa da listagem administrativa. MANAGER, STAFF e VIEWER podiam receber email, userId, notas internas e campos de risco junto dos nomes dos responsáveis.

A rota passa a usar uma consulta dedicada com select de id e name, mantendo filtro de orgId e pessoa ativa. A listagem administrativa /people preserva seu contrato e restrição ADMIN. O BFF também valida e remove campos extras, protegendo o cliente se uma API mais antiga devolver a linha completa. Os consumidores operacionais usam ID/nome para filtros e seleção; a capacidade detalhada continua na fonte operacional própria.

## Execução financeira sem sucesso simulado

createAutomationCharge apenas retornava ok, e o worker concluía jobs sem criar cobrança. A operação permanece indisponível e agora lança erro explícito, sem inventar uma criação bem-sucedida. Tipos de job desconhecidos também falham.

payment-reminder passa a validar orgId/chargeId, consultar a cobrança no tenant informado e executar o envio uma vez. O worker deixa de chamar o envio direto uma segunda vez. Os resultados distinguem queued, duplicate e skipped, com motivo quando a cobrança foi encerrada ou não há telefone. Uma cobrança ausente/estrangeira e uma resposta de enqueue sem identificação da mensagem geram falha.

queued confirma admissão no pipeline; não significa entrega externa. duplicate informa mensagem já existente, sem prometer novo envio ou entrega. skipped indica processamento sem novo envio. Um job skipped pode aparecer como completed no BullMQ porque seu processamento terminou; o returnvalue contém a decisão de não enviar.

Os testes verificam o estado real do BullMQ em Redis. O hook QueueService.updateJobStatus já era um método sem persistência; esta entrega não cria registros de jobs no Prisma nem apresenta esse hook como fonte de estado.

## Verificação

- API: 152 suítes e 928 testes unitários aprovados.
- Frontend/BFF: 95 arquivos e 769 testes aprovados, incluindo remoção de campos privados de uma resposta antiga.
- PostgreSQL e HTTP: cinco testes aprovados. Os quatro papéis recebem somente a pessoa ativa do tenant, como ID/nome; VIEWER não acessa a rota administrativa, e ADMIN preserva o acesso completo. A autenticação é substituída por contexto de teste; RolesGuard e consultas PostgreSQL são reais.
- Redis real: seis testes aprovados em uma fila com nome exclusivo. Criação indisponível e job desconhecido ficam failed; lembrete válido fica completed com resultado queued e uma chamada de envio; cobrança de outra empresa e falta de confirmação ficam failed; cobrança cancelada retorna skipped sem enviar.
- Typecheck de API e web, build dos três pacotes, validador operacional web e git diff --check aprovados.

Não houve migration, envio externo, acesso a produção ou alteração de hospedagem. Redis e PostgreSQL usados na prova são descartáveis; os envios WhatsApp são substituídos por um adaptador de teste. A fila de prova é isolada por nome e removida após a execução.
