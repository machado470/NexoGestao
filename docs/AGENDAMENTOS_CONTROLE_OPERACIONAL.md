# Agendamentos como centro operacional de entrada da execução

A página **Agendamentos** é a entrada operacional do tempo no Nexo Operating System. Ela não deve parecer calendário genérico nem lista administrativa: sua função é decidir o que fazer agora, preparar atendimento, reduzir no-show e conectar o ciclo **Cliente → Agendamento → O.S. → Cobrança → Pagamento** usando somente dados já carregados pelo frontend.

## Direção operacional

Quando há um agendamento em foco, a ordem da experiência deve privilegiar execução:

1. **Hero Executivo do Agendamento** com cliente em destaque, status forte, data/hora/duração, responsável, serviço/contexto, sinal principal, próxima ação e CTAs reais.
2. **Decisão e próxima ação** como bloco único, reunindo estado operacional, maior risco, motivo, impacto, próxima ação recomendada e nota de segurança.
3. **Pipeline principal** limitado a Cliente, Agendamento, O.S., Cobrança e Pagamento.
4. **Resumo operacional** em formato de mini-dashboard com Hoje, Confirmados, Não confirmados, Atrasados e Concluídos.
5. **Atenção imediata** com incidentes compactos de confirmação, atraso, no-show, conflito calculável e fallback honesto quando a fonte não entrega resposta do cliente.
6. **Timeline/prova operacional** humanizada, sem UUIDs, hashes, slugs internos, metadata bruta ou `eventType` cru.
7. **Lista/carteira operacional** como apoio depois do detalhe, com filtros rápidos e estado vazio claro para filtro sem resultado.

## CTAs permitidos

Os botões devem apontar para fluxos reais já existentes:

- Abrir cliente.
- Abrir agendamento em foco.
- Remarcar/editar pelo formulário existente.
- Abrir ou criar O.S. pelo fluxo existente.
- Abrir WhatsApp com contexto do cliente/agendamento, sem automatizar disparo.
- Ver financeiro do cliente.
- Ver timeline completa.
- Confirmar ou cancelar agendamento usando mutações já existentes.

## Pipeline e dados sensíveis

- O fluxo principal deve permanecer **Cliente → Agendamento → O.S. → Cobrança → Pagamento**.
- Timeline, risco e governança podem aparecer como prova, chips auxiliares ou texto contextual, mas não como etapas principais do pipeline.
- O.S. e cobrança vinculadas devem ser mostradas como estados humanos, por exemplo: “Vinculada”, “Aberta”, “Pendente”, “Sem cobrança”.
- IDs técnicos, UUIDs, hashes e slugs internos não devem ser exibidos como conteúdo operacional.

## Limites intencionais

- Sem backend novo.
- Sem alteração de API, Prisma, rotas, contratos, payloads ou segurança multi-tenant.
- Sem alteração da WhatsAppPage.
- Sem automação falsa: a tela pode orientar e abrir fluxos existentes, mas não deve prometer envio automático, confirmação automática ou cobrança automática.
- Sem dados inventados: quando a fonte não entrega resposta do cliente, conflito ou timeline oficial, a interface deve declarar o limite de forma honesta.
- Sem inferir atraso sem data válida e sem afirmar conflito sem início/fim e mesmo cliente ou responsável nos dados carregados.

## Critérios visuais

- Manter tokens do Nexo e compatibilidade dark/light.
- Não adicionar Flowbite como dependência.
- Usar laranja apenas para CTA, gargalo, risco ou ação.
- Evitar cards gigantes vazios e reduzir altura morta.
- Lista operacional deve apoiar a decisão quando há seleção, não competir com o detalhe executivo.
