# Agendamentos como centro operacional de entrada da execução

A página **Agendamentos** é a entrada operacional do tempo no Nexo Operating System. Ela não deve parecer calendário genérico nem lista administrativa: sua função é decidir o que fazer agora, preparar atendimento, reduzir no-show e conectar o ciclo **Cliente → Agendamento → O.S. → Cobrança → Pagamento** usando somente dados já carregados pelo frontend.

## Direção operacional

Quando há um agendamento em foco, a ordem da experiência deve privilegiar execução e manter o **Hero Executivo** como primeiro elemento operacional imediatamente abaixo do cabeçalho da página:

1. **Hero Executivo do Agendamento** domina a leitura com cliente em destaque, status forte, data/hora/duração, responsável, serviço/contexto e sinal principal. A busca, chips e filtros assumem papel secundário e não devem competir com o agendamento selecionado.
2. **Decisão e próxima ação** como bloco único, reunindo estado operacional, maior risco, motivo, impacto, próxima ação recomendada e nota de segurança.
3. **Pipeline principal** limitado a Cliente, Agendamento, O.S., Cobrança e Pagamento.
4. **Resumo operacional** em formato de mini-dashboard com Hoje, Confirmados, Não confirmados, Atrasados e Concluídos.
5. **Timeline/prova operacional** humanizada antes da carteira: a Timeline é evidência operacional, sustenta auditoria e nunca deve aparecer depois da navegação de carteira.
6. **Radar operacional** substitui Atenção Imediata pesada: incidentes compactos de confirmação, atraso, no-show, conflito calculável e fallback honesto quando a fonte não entrega resposta do cliente.
7. **Lista/carteira operacional** é navegação secundária de apoio depois do detalhe, da prova e do radar, com filtros rápidos e estado vazio claro para filtro sem resultado.

## Responsabilidade dos CTAs

Os botões devem apontar para fluxos reais já existentes, sem duplicar a mesma responsabilidade em vários blocos:

- **Hero:** abrir o agendamento em foco.
- **Decisão:** remarcar/editar quando houver seleção ou executar a próxima ação contextual quando não houver seleção.
- **Pipeline:** abrir cliente, abrir/criar O.S. e abrir financeiro conforme a etapa operacional.
- **Radar operacional:** resolver incidente do item crítico.
- **Carteira:** selecionar item, confirmar/cancelar, iniciar atendimento, editar/remarcar, abrir cliente, WhatsApp contextual e O.S. quando aplicável.

## Pipeline e linguagem humana

- O fluxo principal deve permanecer **Cliente → Agendamento → O.S. → Cobrança → Pagamento**.
- Timeline, risco e governança podem aparecer como prova, chips auxiliares ou texto contextual, mas não como etapas principais do pipeline.
- O pipeline nunca deve exibir estados internos, enums crus, `eventType`, UUIDs, hashes, slugs técnicos ou identificadores como conteúdo para operadores.
- Estados técnicos devem ser traduzidos para linguagem humana. Exemplos obrigatórios:
  - `IN_PROGRESS` → “Em execução”.
  - `PENDING` → “Pendente” ou “Cobrança pendente”, conforme o contexto.
  - `COMPLETED`/`DONE` → “Concluído”/“Concluída”.
  - `FAILED` → “Falhou”.
  - `CANCELLED`/`CANCELED` → “Cancelado”.
  - `PROCESSING` → “Em processamento” ou “Em execução”, conforme o contexto.
- Exemplos de semântica operacional esperada:
  - Cliente: “Cliente vinculado”.
  - Agendamento: “Confirmado”, “Sem confirmação” ou “Atrasado”.
  - O.S.: “Sem O.S.”, “O.S. aberta”, “Em execução” ou “Concluída”.
  - Cobrança: “Sem cobrança”, “Cobrança pendente”, “Cobrança vencida” ou “Cobrança paga”.
  - Pagamento: “Aguardando pagamento” ou “Pagamento recebido”.

## Timeline, radar e carteira

- **Timeline é evidência operacional:** deve vir antes da carteira e apresentar eventos humanizados, derivados de dados reais ou retornados pela fonte oficial.
- **Carteira é navegação secundária:** lista e filtros ajudam a trocar o foco, mas não podem dominar quando há agendamento selecionado.
- **Radar operacional é compacto:** deve manter cliente, horário, risco e próxima ação, com baixa altura, menor padding e menor peso visual para não competir com o Hero.
- **Nenhum identificador técnico pode aparecer para operadores:** IDs, UUIDs, hashes, slugs internos, metadata bruta, status internos e enums crus são vazamentos de backend.

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
- Dropdowns como **Mais filtros** devem ter camada acima de carteira, tabelas, cards e timeline, sem clipping por overflow ou stacking context inferior.
- Lista operacional deve apoiar a decisão quando há seleção, não competir com o detalhe executivo.
