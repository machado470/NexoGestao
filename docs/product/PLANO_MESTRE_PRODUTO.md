---
status: current
owner: nexogestao
last_reviewed: 2026-11-12
source_of_truth: true
scope: "visão estratégica e diretrizes de evolução; não substitui regras de domínio implementadas"
---

# Plano Mestre do Produto — NexoGestão

## Autoridade e escopo
Este é o registro oficial das ideias de produto e decisões estratégicas aprovadas para planejamento. Não afirma que funcionalidades estejam ausentes ou concluídas. Para implementação real prevalecem código, migrations e testes; para arquitetura e contratos valem docs/index.md, docs/architecture/system-context.md, ADRs e docs/product/domain-rules.md. Conflitos devem ser identificados antes de qualquer mudança.

## Visão
SaaS multiempresa, modular, inicialmente focado em prestadores de serviços e projetado para expansão. Unificar clientes, pessoas, orçamentos, contratos/aceites, agenda, ordens de serviço, execução, materiais, financeiro, comunicação, histórico e governança. A ordem de serviço é o eixo operacional nos segmentos aplicáveis.

## Diretrizes permanentes
1. Isolamento por organização e permissões verificadas em API, BFF, dados, filas, relatórios e integrações.
2. Segurança, privacidade/LGPD, trilha de auditoria e integridade financeira desde o projeto.
3. Backups testados, recuperação de desastre, observabilidade, alertas, testes e rollback.
4. Fluxos de ponta a ponta valem mais que telas isoladas.
5. UX específica para administradores, equipes de campo e clientes, priorizando mobile quando relevante.
6. Modularidade por necessidades e planos da empresa, com configuração explícita.
7. IA usa apenas dados autorizados e verificáveis; decisões e ações sensíveis exigem confirmação humana.
8. Indicadores, riscos, estados e recomendações são calculados por contratos oficiais, não por suposições locais do frontend.
9. Evoluções devem reutilizar padrões existentes, evitar código duplicado e preservar compatibilidade documentada.
10. Nenhuma remoção de arquivo, migration, registro ou contrato sem análise de impacto, teste e estratégia de reversão.

## Ideias aprovadas para avaliação e roadmap
- P01 CRÍTICA: multiempresa comprovadamente isolada e papéis/permissões consistentes.
- P02 CRÍTICA: backup, restauração testada e continuidade do serviço.
- P03 CRÍTICA: segurança, LGPD, auditoria e políticas de retenção/exportação.
- P04 CRÍTICA: observabilidade, CI, testes automatizados, rollback e tratamento de falhas.
- P05 ALTA: fluxo comercial completo — solicitação → orçamento → aprovação → contrato/aceite → agenda/O.S. → execução → faturamento → pagamento.
- P06 ALTA: modo operacional mobile de funcionários, checklists, fotos, evidências, responsáveis e andamento.
- P07 ALTA: modelo SaaS comercial — planos, cobrança recorrente, onboarding, suporte, cancelamento e portabilidade de dados.
- P08 MÉDIA: portal do cliente para acompanhamento, aprovações, documentos e pagamentos.
- P09 MÉDIA: estoque, materiais, custos e margem por serviço (validar demanda do nicho).
- P10 MÉDIA: assistente de IA operacional com respostas rastreáveis e limites de ação.
- P11 EVOLUÇÃO: integração WhatsApp, notificações e automações seguras e monitoradas.
- P12 ALTA: dashboard executivo e relatórios consolidados usando dados reais.

As prioridades são propostas; confrontar cada capacidade com a implementação atual e necessidades de clientes antes de abrir novas tarefas.

## Ordem de trabalho aprovada
### Fase A — Inventário sem edição
Mapear todas as telas/rotas, componentes, hooks, serviços, endpoints, Prisma, migrations, jobs, testes, scripts, dependências, documentação e infraestrutura. Identificar arquivos legados, duplicados, não referenciados, desatualizados e itens fora do padrão. Classificar: ATIVO, LEGADO EM USO, CANDIDATO A REMOÇÃO, DUPLICADO, DESATUALIZADO, INCOMPLETO ou NÃO VERIFICADO. Exigir caminho, evidência de uso/não uso, dependências e impacto.

### Fase B — Saneamento controlado
Criar checkpoint recuperável. Validar uso indireto (imports dinâmicos, DI, scripts, filas, eventos, consumidores externos, deploy, seeds, relatórios e dados). Propor lotes pequenos de remoção/refatoração com revisão explícita. Não apagar automaticamente; rodar build, lint, testes e verificações de isolamento multi-tenant após cada lote. Registrar remoções e rollback.

### Fase C — Padronização
Alinhar interface, nomenclatura, design system, APIs/BFF, contratos, documentação e configurações. Não criar segunda fonte de verdade.

### Fase D — Evolução por fases
Priorizar base segura, fluxo empresarial completo, experiência de funcionários e clientes, IA assistiva e comercialização. Cada entrega precisa de objetivo, critérios de aceite, regras de negócio, permissões, testes, dependências e estratégia de rollout.

## Instruções para Codex/Work
Antes de propor trabalho, consultar este plano, docs/index.md, docs/PROJECT_STATE.md, docs/DEV_RULES.md e documentos normativos relevantes. Na primeira varredura trabalhar SOMENTE EM LEITURA. Não executar exclusões, mudanças de schema, migrações destrutivas nem reformatações amplas. Entregar matriz de achados com arquivo, evidência, classificação, risco, prioridade, ação recomendada e testes associados. Só executar limpeza após autorização específica e plano de rollback.

## Estado
Registrado em 2026-11-12. Este documento preserva ideias e decisões de planejamento; não substitui auditoria integral do código.
