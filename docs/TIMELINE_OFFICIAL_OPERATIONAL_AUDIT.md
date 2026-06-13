# Timeline como prova oficial da operação

A página **Timeline** é a fonte oficial de auditoria operacional do NexoGestão. Ela não é feed social e não substitui o AuditEvent técnico: sua função é provar, em linguagem operacional, o que aconteceu na rotina da organização.

## Contrato de prova

Cada item exibido deve preservar somente dados recebidos das fontes existentes da Timeline:

- tipo do evento normalizado;
- descrição curta operacional;
- entidade e identificador quando a fonte informar;
- ator/responsável quando a fonte informar;
- data/hora do evento;
- metadados resumidos quando existirem em formato simples.

Quando ator, módulo, entidade ou metadados não vierem da fonte, a interface deve declarar o fallback de forma explícita. A tela não deve inferir automação, reconstruir eventos ausentes ou mascarar lacunas de rastreabilidade.

## Governança e risco

A Timeline sustenta risco e governança porque permite responder rapidamente:

1. qual evento ocorreu;
2. qual módulo operacional foi afetado;
3. qual entidade pode ser investigada;
4. quem foi informado como ator;
5. quais metadados justificam atenção, criticidade ou restrição.

Eventos críticos e de alta severidade devem ser visualmente priorizados para não ficarem escondidos em ruído de baixa relevância.

## CTAs permitidos

A página só deve oferecer CTAs de investigação quando houver `entityType`/`entityId` ou campos equivalentes utilizáveis na fonte oficial, como `customerId`, `serviceOrderId`, `appointmentId` ou `chargeId`. Os CTAs permitidos são navegação para Cliente, O.S., Financeiro, Agendamento, WhatsApp e Governança. Eles não executam automação.

## Estados compactos

A leitura operacional usa estados compactos:

- saudável: eventos recentes sem criticidade detectável no recorte;
- atenção: risco, atraso, falha ou silêncio recente;
- crítico: evidência restritiva ou falha relevante;
- vazio: nenhum evento oficial no recorte;
- erro: falha de carregamento da fonte oficial.
