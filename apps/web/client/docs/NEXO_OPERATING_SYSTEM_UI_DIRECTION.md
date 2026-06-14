# Nexo Operating System UI Direction

A imagem aprovada em 4 partes é referência de direção visual e estrutural, não contrato literal. O Nexo deve traduzir a intenção para componentes reais do produto, preservando a identidade operacional e evitando copiar pixels, Flowbite, templates SaaS ou padrões genéricos.

## Conceito central

**Decisão → Fluxo → Execução → Auditoria**

O front interno deve parecer um sistema operacional para empresas de serviço: abre com prioridades, mostra o fluxo completo, permite executar ações reais e sustenta cada leitura com prova operacional e governança.

## Quadrantes de referência

1. **Centro de Prioridades**  
   Dashboard deve abrir com estado, dinheiro em risco, gargalo e próxima ação.

2. **Fluxo Operacional**  
   Cliente → Agendamento → O.S. → Cobrança → Pagamento, com gargalo, conversão e CTA.

3. **Centro Operacional do Cliente**  
   Clientes deve ser memória viva da operação, não cadastro.

4. **Timeline + Governança + Risco**  
   Timeline prova o que aconteceu; Governança explica o que o sistema decidiu.

## Regras visuais

- Navy/charcoal, bordas sutis e profundidade leve formam a base premium.
- Laranja é reservado para CTA primário, ação, gargalo, warning e risco operacional.
- Verde indica saudável/sucesso; vermelho indica crítico real; azul/cinza comunica informação neutra.
- Labels devem ser curtos, em uppercase, com títulos claros e microcopy operacional.
- Não usar laranja decorativo, excesso de glow, charts inúteis, cards vazios altos, sombras exageradas ou fundo preto puro.

## Regras de produto

- Não transformar o Nexo em SaaS genérico.
- Não copiar Flowbite, templates externos ou catálogo visual.
- Não criar mock, automação falsa ou dado inventado.
- Usar somente dados já carregados pela página; fallback deve declarar ausência de sinal retornado.
- Timeline embutida não é log técnico: deve ser prova oficial humanizada, sem payload bruto, IDs internos ou `eventType` cru.
- Governança embutida não é alerta passivo: deve explicar estado, motivo, impacto, decisão do sistema, próxima ação e CTA real.

## Componentes internos obrigatórios nesta direção

- `AppPageShell`
- `AppPageHeader` / `AppOperationalHeader`
- `AppSectionBlock` / `AppSectionCard`
- `AppStatCard`
- `AppStatusBadge`
- `OperationalCommandLayer`
- `NexoPriorityPanel`
- `NexoOperationalPipeline`
- `NexoEvidenceTimeline`
- `NexoGovernanceDecisionCard`
- `NexoIncidentList`
- `NexoExecutiveMetric`

## Páginas impactadas nesta fase

- `ExecutiveDashboard`: centro diário de prioridades, dinheiro em risco, gargalo, NBA dominante, pipeline e prova compacta.
- `CustomersPage`: centro operacional do cliente, barra operacional compacta, pipeline protagonista, resumo condensado e Timeline humanizada.
