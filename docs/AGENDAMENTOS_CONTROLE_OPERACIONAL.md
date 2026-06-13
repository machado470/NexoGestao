# Agendamentos como controle operacional do tempo

A página **Agendamentos** é a entrada da execução operacional do NexoGestão. Ela não deve funcionar como um calendário genérico: sua responsabilidade é organizar o tempo, confirmar presença, preparar atendimento e abrir ou criar O.S. usando apenas dados e fluxos já existentes.

## Papel operacional

- **Tempo**: prioriza hoje, próximos horários, atrasos e cancelamentos.
- **Confirmação**: destaca agendamentos ainda `SCHEDULED` como não confirmados, sem inventar automação.
- **Preparação**: mostra cliente, serviço/contexto, responsável quando a fonte entrega, duração quando há início e fim, observação curta e vínculo com O.S.
- **Execução**: oferece ações reais já disponíveis: confirmar, iniciar atendimento, abrir/criar O.S., remarcar/editar, cancelar, enviar WhatsApp e abrir cliente.
- **Prova operacional**: usa Timeline oficial quando carregada; quando não existe retorno, informa fallback honesto e não cria histórico fictício.

## Limites intencionais

- Não altera backend, API, Prisma, rotas, contratos ou fontes de dados.
- Não altera a WhatsAppPage.
- Não infere atraso sem data válida.
- Não afirma conflito sem início/fim e sem mesmo cliente ou responsável nos dados carregados.
- Não afirma cliente sem resposta quando a fonte atual não entrega esse sinal.
- Não executa automação; botões apenas abrem ou usam fluxos existentes com confirmação do usuário.

## Critérios de UI

A tela deve manter:

1. Header operacional de agenda.
2. Chips compactos: hoje, não confirmados, atrasados, próximos e cancelados.
3. Alertas compactos com fallback explícito para sinais indisponíveis.
4. Próxima melhor ação baseada somente na carteira carregada.
5. Lista operacional principal com horário, cliente/contexto, status, responsável, duração/prazo quando disponível e observação curta.
6. Detalhe focado em cliente, horário, status, preparação da execução, comunicação e histórico/timeline.
