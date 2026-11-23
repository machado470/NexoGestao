# Nexo Gestão — Plano Mestre de Melhorias e Prontidão

**Data-base:** 22 de novembro de 2026  
**Origem:** auditoria conversacional em leitura do repositório `machado470/NexoGestao`, fontes do frontend, API, testes e documentação.  
**Status:** plano de auditoria e execução; **não** é laudo de aprovação para produção.  
**Política:** nenhuma alteração em produção, banco, credenciais, variáveis ou migrações sem autorização específica. Auditar antes de modificar; reproduzir antes de corrigir.  
**Última edição deste documento:** 22/11/2026.

## 1. Resumo executivo

O Nexo Gestão possui uma base operacional extensa: clientes, pessoas, agenda, calendário, orçamentos, catálogo, ordens de serviço, financeiro, estoque, fiscal preparatório, WhatsApp, governança, dashboards, Timeline, auditoria, planos, configurações, onboarding e páginas públicas. Existem testes de integração com PostgreSQL/Redis e roteiros de navegador. Várias suspeitas iniciais foram **corrigidas em rodadas anteriores**; não reabrir bugs sem confronto com o código atual.

**Maior prioridade de produto a investigar:** nas ações `executions.start`, `executions.complete` e `serviceOrders.generateCharge`, o frontend chama a mutação e depois `refreshEverything()` dentro do mesmo `try/catch`. Falha da leitura/invalidação posterior pode ser comunicada como falha da ação principal, embora ela já tenha sido confirmada. **Achado por leitura de código; falta teste de reprodução no navegador.**

**Maior lacuna operacional:** recuperação local de backups demonstrada, mas runbook ainda registra **ausência de comprovação de offsite, alertas entregues, DR owner, RPO/RTO e plataforma real de produção confirmada**. O estado efetivo de produção não foi consultado nesta auditoria.

**Regra de produto:** ampliar o que está comprovado; evitar expansão de escopo antes do piloto. Não transformar riscos teóricos em bugs confirmados.

## 2. Legenda de status e prioridades

- **Confirmado por inspeção:** comportamento verificável no código, mas não necessariamente reproduzido por teste nesta rodada.
- **Evidência histórica:** teste ou correção registrada anteriormente, não reexecutada no HEAD atual.
- **Pendente de validação:** ainda não foi comprovado em ambiente/versão representativos.
- **Decisão de negócio:** precisa de responsável/escopo antes de implementação.
- **P0:** pode afetar segurança, integridade financeira/dados, recuperação ou induzir operação duplicada. É prioridade de avaliação, não incidente confirmado.
- **P1:** funcionalidade essencial, experiência comercial ou escala importante.
- **P2:** melhoria de usabilidade, desempenho ou expansão após controles essenciais.

## 3. Registro mestre de ações

| ID | Prioridade | Tema | Evidência atual / condição | Próxima ação | Aceite objetivo |
|---|---|---|---|---|---|
| NEXO-001 | P0 | Pós-confirmação de O.S. | `ServiceOrdersPage.tsx`: `handleStart`, `handleComplete`, `handleGenerateCharge` aguardam `refreshEverything` dentro do `try` da mutação; inspeção de código | Reproduzir mutação com sucesso + refetch falhando; criar regressão; separar resultado de gravação e atualização da tela | Sucesso confirmado nunca é apresentado como falha de gravação; aviso de consulta independente; sem segunda mutação involuntária |
| NEXO-002 | P0 | Jornada integrada atual | Rodada de 12/11: 23 integrações com infra real; navegador móvel com fixtures simuladas; evidência histórica | Reexecutar na revisão atual, com API/PostgreSQL/Redis reais e dados fictícios isolados | Cliente → agenda → O.S. → execução → cobrança → pagamento → dashboard/Timeline/Auditoria consistentes; sem vazamento de tenant |
| NEXO-003 | P0 | DR, backups externos e alertas | Runbook declara offsite não comprovado, alerta externo ausente, owner/RPO/RTO indefinidos | Definir responsável e política; provar upload, download, checksum, restore isolado, monitoramento e alerta entregue | Evidência auditável de recuperação e alerta em ambiente autorizado; sem ação destrutiva em produção |
| NEXO-004 | P0 | Sessão e RBAC | Testes de revogação e usuários inativos, inclusive PostgreSQL real; evidência histórica | Revalidar no HEAD com sessão do navegador aberta, desativação/troca de papel e isolamento multiempresa | Sessão antiga não acessa dados nem executa mutações; respostas 401/403/404 coerentes |
| NEXO-005 | P0 | Pagamento sob falhas | `manual-payment-flow.test.ts` cobre resposta perdida, chave e concorrência; pagamento manual bem protegido; evidência histórica | Integrar com API real, interrupção de resposta, recarregamento e concorrência; examinar garantia final no backend | Uma tentativa incerta não duplica pagamento; parcelas novas legítimas são registradas |
| NEXO-006 | P1 | Estoque concorrente | UI usa `entryKey` para movimento; implementação de backend não foi integralmente auditada nesta rodada | Testar duas saídas simultâneas, estoque insuficiente, retry e conflito | Saldo não fica negativo indevidamente; nenhum lançamento duplicado |
| NEXO-007 | P1 | Escala e custos | Ensaios de capacidade com 501 clientes/501 O.S./1001 agendas e multiempresa; **não** são benchmark sustentado | Definir metas p95/p99, VUs/RPS, recursos; rodar ensaio de carga isolado e observar PostgreSQL/Redis/filas | Curvas de latência, erro, CPU, memória e conexões por perfil de uso registradas |
| NEXO-008 | P1 | Desktop | `MainLayout.tsx` usa sidebar 88px/292px, mas conteúdo mantém margem 88px; expansão funciona como overlay | Validar 1024/1280/1440/1920 px, sidebar expandida/recolhida, modais, foco e conteúdo denso | Sem controles inacessíveis, truncamento não intencional ou overlay persistente; navegação previsível |
| NEXO-009 | P1 | Acessibilidade/mobile real | Testes Chromium 320/390 px; Safari/iPhone físico não comprovado | Verificar Safari real, teclado nativo, VoiceOver/leitor de tela, navegação por teclado, contraste e foco | Fluxos essenciais executáveis sem mouse; sem bloqueios por teclado/viewport |
| NEXO-010 | P1 | Privacidade | AU11 parcial; exports por cliente e testes de tenant existem; procedimento completo pendente | Definir owner, canal, verificação de identidade, retenção, entrega e provedores/backups | Solicitação fictícia exercitada do recebimento ao encerramento com protocolo e evidências |
| NEXO-011 | P1 | Plataforma e deploy | Compose e Railway versionados; runbook não confirma plataforma real | Identificar destino operacional; revisar migrations, rollback, smoke, segredos e dependências | Runbook reflete realidade; rollback compatível com esquema e backup aprovado |
| NEXO-012 | P1 | Stripe/assinaturas | Checkout/cancelamento existem; integração externa real não validada nesta auditoria | Testar sandbox de contratar → webhook → ativar → cancelar → reativar e limites | Estado de assinatura e permissões sincronizados sem dupla cobrança |
| NEXO-013 | P1 | WhatsApp externo | Inbox, aprovações, DLQ/replay, limites e testes com mock/infra reais | Validar provider habilitado em sandbox, assinaturas de webhook, falha de envio, retry, duplicidade e DLQ | Entrega/erro auditáveis; bloqueios e quotas por tenant preservados |
| NEXO-014 | P1 | Consistência de painéis | Rodada operacional histórica checou dashboard e timeline após pagamentos; novo HEAD não validado | Comparar IDs, valores, moeda, contagens, alertas e estados logo após mutações e após reload | Todos os módulos apresentam os mesmos fatos persistidos |
| NEXO-015 | P1 | Carteira financeira extensa | `FinancesPage.tsx` faz `charges.list({page:1,limit:500})`, filtros locais; alcance acima disso exige verificação | Testar 501+ cobranças e investigar contrato atual para paginação/filtros remotos | Busca e totais não omitem itens fora da primeira página |
| NEXO-016 | P1 | Custo por tenant | Não há apuração consolidada verificada nesta rodada | Coletar custos reais de Railway/Postgres/Redis/storage/backups/observabilidade/Stripe/WhatsApp + consumo por plano | Margem, custo fixo, variável e cenário de pico documentados, sem números inventados |
| NEXO-017 | P2 | Refinamento visual | Auditorias anteriores apontaram gerações distintas de componentes, espaços, overlays e densidade | Rodada visual por página: claro/escuro; desktop/tablet/mobile; dados longos e vazios | Padrão visual consistente sem esconder regras operacionais |
| NEXO-018 | P2 | AU08/motor genérico | Documento de 12/11 classifica como parcial | Definir se entra no escopo comercial; não prometer antes de concluir | Escopo e promessas alinhados com capacidade real |

## 4. Conclusões que **não devem virar bugs novos** sem revalidação

1. **Paginação e volume em Clientes, O.S., Agendamentos, Calendário e WhatsApp:** auditoria de 11/11 identificou cortes antigos; relatório posterior registrou correções e teste com 501 clientes, 501 O.S., 1001 agendamentos, 55 conversas e 101 mensagens. Regressão atual é válida; reabrir correção histórica sem evidência, não.
2. **Sessão revogada:** `session-revocation.spec.ts` cobre alteração de active/role/password/orgId; testes PostgreSQL mostram 401 para sessão revogada e usuário/pessoa inativos, 403 para papel sem autorização em rotas examinadas. Não prova todos os endpoints atuais.
3. **Conversão de orçamento:** prova com PostgreSQL para concorrência, unicidade do vínculo, integridade de moeda/valor e trilha; algumas interfaces foram testadas com harness local.
4. **Pagamento manual/parcial:** fluxo frontend mantém chave em resposta incerta, troca após confirmação legítima e bloqueia duplicidade simultânea. Histórico da chave em memória é perdido ao recarregar; deduplicação final depende do backend.
5. **Redundância de backups/testes de recuperação:** há restore local com checksum e teste real de queda de PostgreSQL/Redis/BullMQ. Isso não prova continuidade/backup externo de produção.
6. **Auditoria de capacidade C01–C10:** relatório de 11/11 registra C01–C04/C06–C08 corrigidos, C05/C09/C10 mitigados ou com limites definidos. Avaliar estado atual antes de abrir PR.

## 5. Matriz por área funcional (escopo já percorrido)

- **Dashboard:** indicadores, alertas, timeline, recomendações e navegação; conferir consistência e autorizações.
- **Clientes:** cadastro, edição, contexto de atendimento/cobrança, filtros, detalhe; testar dados densos e navegação desktop.
- **Agendamentos/Calendário:** criação e edição, capacidade, fuso, período e conflitos; validar calendário com mudanças concorrentes.
- **Orçamentos/Catálogo:** criação/revisão/compartilhamento, resposta externa e conversão; testar expiração, versão aprovada e links públicos.
- **Ordens de serviço:** inicio/conclusão, retorno, aceite, vínculo, cobrança; prioridade NEXO-001.
- **Financeiro:** cobrança, pagamento parcial, cancelamento, filas e indicadores; prioridade NEXO-005/NEXO-015.
- **Estoque/Fiscal/Saúde financeira:** SKU, movimentos, rascunhos fiscais, despesas; não confundir rascunho fiscal com emissão oficial; testar movimentações simultâneas.
- **Pessoas/Perfil:** vínculos, papéis, capacidades, indisponibilidade; testar revogação e acessibilidade.
- **Governança/Timeline/Auditoria:** sinais, histórico, autoria, tenant e evidências; cruzar com fatos financeiros.
- **WhatsApp/Webhook recovery:** inbox, mensagens, aprovações, retry e DLQ; validar provider externo e falhas.
- **Assinaturas/Configurações/Onboarding:** estados, limites, checkout, alteração de organização; validar jornada, recuperação de etapas parciais e isolamento.
- **Público/Auth:** login, cadastro, recuperação, convite, consentimento, aprovação de orçamento e aceite; validar expiração e segurança dos links.

## 6. Plano por ondas

### Onda 0 — Evidência e congelamento de escopo
- Confirmar SHA atual da `main`, PRs pendentes, CI, migrations e target de produção; sem assumir merge/deploy.
- Revisar status de cada NEXO-ID por evidência no HEAD; preparar testes isolados, sem dados reais.

### Onda 1 — Integridade e operações críticas (antes de piloto)
- NEXO-001, 002, 004, 005, 014 e 015; executar com organizações de teste distintas.
- Tratar mutação confirmada + atualização falha como dois resultados separados.
- Preservar observabilidade, auditoria, idempotência, RBAC e isolamento.

### Onda 2 — Continuidade e governança operacional
- NEXO-003, 010, 011, 012 e 013. Restrições de publicação e decisão de integração externa explícitas.

### Onda 3 — Experiência, escala e economia
- NEXO-006, 007, 008, 009, 016 e 017.
- Medir, não estimar capacidade sem benchmarks; comparar UX desktop e mobile por jornada.

### Onda 4 — Piloto
- Organização fictícia de ensaio e depois piloto restrito com acompanhamento, somente após aprovação de segurança, dados, integridade e operação.
- Estabelecer canais de suporte, rollback, triagem de incidentes, indicadores de qualidade e limites de escopo comercial.

## 7. Critérios de saída para piloto pagante

**Obrigatórios, com evidência anexável:**

- CI do commit candidato aprovado; smoke de API/web/BFF e migrations em ambiente apropriado.
- Autenticação, RBAC, sessões e isolamento de tenants testados no commit candidato.
- Fluxo crítico entre cliente, agenda, O.S., financeiro, dashboard e auditoria consistente sob sucesso, erro e resposta perdida.
- Backups/recuperação com procedimento aprovado, responsável, monitoramento e prova de alerta; sem manipular produção para obter demonstração.
- Política operacional de privacidade e retenção definida com responsável.
- Escopo claro do que Stripe/WhatsApp estão efetivamente habilitados a fazer e provados.
- Processo de rollback, suporte e incidentes definido.

**Não exigidos para primeiro piloto restrito, se excluídos da oferta:** motor genérico de regras AU08, BI avançado, integrações novas, melhorias cosméticas menores e cargas maiores que o perfil contratado. A exclusão deve ser visível na oferta e não conflitar com regras essenciais.

## 8. Instruções para Codex ou Claude

> **Tarefa inicial (somente leitura):** leia `PLANO_MESTRE_NEXOGESTAO_2026-11-22.md`, confira cada achado no HEAD atual, cite caminhos/linhas, classifique como reproduzido, corrigido, pendente ou desatualizado e monte uma fila de PRs pequenas. Não altere arquivos, banco, segredos, migrations ou infraestrutura nesta fase. Não assuma que evidência histórica equivale a CI atual. Para NEXO-001, defina um teste de regressão com mutação bem-sucedida seguida de falha de leitura e proponha a menor mudança possível, sem executá-la sem autorização específica.

**Modelo para cada futura PR:** ID; problema reproduzido; impacto; arquivos autorizados; não escopo; testes antes/depois; rollback; evidência; checklist de segurança; aprovação para executar.

## 9. Fontes auditáveis

- Código das O.S.: https://github.com/machado470/NexoGestao/blob/main/apps/web/client/src/pages/ServiceOrdersPage.tsx
- Código financeiro: https://github.com/machado470/NexoGestao/blob/main/apps/web/client/src/pages/FinancesPage.tsx
- MainLayout desktop: https://github.com/machado470/NexoGestao/blob/main/apps/web/client/src/components/MainLayout.tsx
- Testes pagamento: https://github.com/machado470/NexoGestao/blob/main/apps/web/client/src/lib/manual-payment-flow.test.ts
- Testes sessão: https://github.com/machado470/NexoGestao/blob/main/apps/api/test/integration/tracks-roles-session-postgres.integration.spec.ts
- Fluxo operacional real: https://github.com/machado470/NexoGestao/blob/main/docs/audits/2026/2026-11-12-operational-revalidation.md
- Capacidade (diagnóstico **anterior**): https://github.com/machado470/NexoGestao/blob/main/docs/audits/2026/2026-11-11-capacity-performance-audit.md
- Capacidade (correções): https://github.com/machado470/NexoGestao/blob/main/docs/audits/2026/2026-11-11-capacity-corrections.md
- Jornada mobile simulada: https://github.com/machado470/NexoGestao/blob/main/docs/MOBILE_CUSTOMER_TO_PAYMENT_AUDIT.md
- Pagamento parcial: https://github.com/machado470/NexoGestao/blob/main/docs/FINANCE_PARTIAL_PAYMENT_AUDIT.md
- Conversão orçamento/O.S.: https://github.com/machado470/NexoGestao/blob/main/docs/QUOTE_ORDER_CONVERSION_AUDIT.md
- Recuperação PostgreSQL/Redis: https://github.com/machado470/NexoGestao/blob/main/docs/audits/2026/PHASE_2_3C_RECOVERY_PROOF.md
- Runbook produção: https://github.com/machado470/NexoGestao/blob/main/docs/operations/production-runbook.md
- Deploy: https://github.com/machado470/NexoGestao/blob/main/docs/operations/deployment.md
- Privacidade: https://github.com/machado470/NexoGestao/blob/main/docs/audits/2026/2026-11-12-privacy-exports-and-procedure.md
- Arquitetura visual: https://github.com/machado470/NexoGestao/blob/main/docs/audits/2026/FRONTEND_INTERNO_FASE_1_AUDITORIA_2026-09-05.md

## 10. Histórico deste plano

- 22/11/2026: consolidação das duas rodadas de leitura e das evidências históricas registradas no GitHub. **Nenhum teste foi executado nesta entrega e nenhum arquivo do repositório foi modificado.**