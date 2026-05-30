# Pessoas: resumo operacional e gaps

## O que agora é real

- A tela Pessoas usa `GET /people/operational-summary`, sempre limitado ao tenant autenticado no backend.
- A carga por responsável usa `ServiceOrder.assignedToPersonId` para O.S. abertas e atrasadas.
- A agenda por responsável usa `Appointment.assignedToPersonId` para agendamentos futuros ativos e para o recorte de hoje.
- Nome, função e estado ativo/inativo vêm de `Person`.
- A última atividade exibida, quando disponível, vem do último `TimelineEvent` da pessoa dentro do tenant.

## O que ainda não é medido

- Não existe medição confiável de produtividade, performance, eficiência, tempo médio de execução ou qualidade individual.
- Não existe capacidade configurável por pessoa, turno ou especialidade.
- Não existe distribuição automática de O.S. ou agenda com base na carga.

## O que depende de backend futuro

- Histórico detalhado de carga por período.
- Capacidade planejada por jornada, turno, ausência e especialidade.
- Alertas proativos e recomendações de redistribuição.
- Um workspace detalhado da pessoa com paginação própria para O.S., agenda e timeline.

## O que não foi inventado

- A tela não cria score de performance.
- A tela não estima O.S. concluídas, tempo médio, impacto financeiro ou risco individual profundo.
- Os badges de carga são classificações simples e transparentes sobre contagens reais atuais.
