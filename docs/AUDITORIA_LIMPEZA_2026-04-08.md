# Auditoria completa de limpeza — NexoGestao (2026-04-08)

## Escopo e método
- Escopo varrido: `apps/web` (frontend + BFF), `apps/api` (backend), `prisma`, `scripts`, configs raiz.
- Busca textual explícita por termos: `manus`, `legacy`, `old`, `temp`, `draft`, `backup`, `copy`, `placeholder`, `mock`, `TODO`, `FIXME`, `HACK`.
- Análise estática de rotas e navegação (`App.tsx` + `MainLayout.tsx`) e mapeamento de páginas órfãs por presença em roteador.
- Análise estática de roteadores BFF expostos versus consumo no cliente por padrão `trpc.<router>.`.
- Revisão manual de testes placeholder, handlers parciais e pontos de erro silencioso.

## Diagnóstico executivo
1. Há **resíduo de legado/manus** ativo no toolchain de frontend (plugin + coletor dedicado), gerando acoplamento desnecessário para produção SaaS e ruído de auditoria.
2. Há **artefatos claramente herdados** (arquivos `.save`/`.bak`) que não participam do runtime e poluem manutenção.
3. Há **BFF parcialmente mockado** em rotas de contato (history em memória/local), potencializando inconsistência entre UX e API real.
4. Há **testes placeholder** (`expect(true).toBe(true)`) que passam sem validar comportamento real, criando falsa sensação de cobertura.
5. Há **superfície de rotas legacy/alias** extensa (redirecionamentos), indicando acúmulo de caminhos antigos e risco de drift.
6. Há **possíveis áreas mortas/suspeitas** (routers BFF sem consumo no cliente e componentes sem referência) que precisam de validação antes de remoção.

## Achados por categoria

### 1) Código morto / herdado
- Páginas: `ExecutiveDashboardNew` não é roteada diretamente no `App.tsx` (é usada apenas indiretamente por wrapper), devendo ser marcada como candidata a simplificação da hierarquia de página.
- Testes placeholders:
  - `apps/web/server/auth.logout.test.ts` usa `expect(true).toBe(true)`.
  - `apps/web/server/modals.test.ts` idem.
- SDK placeholder no BFF: `apps/web/server/_core/sdk.ts` retorna payload estático (`"SDK placeholder"`).

### 2) Lixo / legado
- Frontend mantém plugin e coletor específicos de Manus no Vite (`vitePluginManusRuntime`, middleware `/__manus__/logs`, injeção de script `__manus__/debug-collector.js`).
- Havia arquivos snapshot/backups de edição versionados (`*.save`, `*.bak`) sem uso de runtime.

### 3) Rotas / páginas desconectadas
- Router possui múltiplas rotas de alias legacy (`/dashboard`, `/executive-dashboard-new`, `/launches`, `/invoices`, `/expenses`, `/referrals`, `/operations`, `/dashboard/operations`) redirecionando para rotas atuais.
- Roteadores BFF expostos no `appRouter` com suspeita de não consumo no cliente (via varredura estática): `system`, `invoices`, `referrals`, `financeAdvanced`, `payments`, `audit`, `risk`.
- Comentário explícito de legado na própria suíte de rotas de logout/modais.

### 4) Bugs funcionais e handlers parciais
- `contactRouter` no BFF mantém histórico como placeholder local:
  - `getContactHistory` devolve array vazio fixo.
  - `createContactHistory` cria objeto efêmero com `crypto.randomUUID()` sem persistência real.
  - `deleteContactHistory` sempre retorna sucesso.
- Isso pode fazer o usuário acreditar que gravou/alterou histórico sem backend persistente.

### 5) Travamentos / performance
- Há seção de *stress lab* ativável por querystring `?stress=1` em Customers, com ações artificiais (multi-clique, navegação com latência e refetch paralelo). Isso é útil em QA, mas em produção pode passar percepção de comportamento instável se exposto.
- O projeto já possui tentativas de mitigação de loading morto em alguns modais (timeouts), mas não é padrão em todas as páginas.

### 6) Inconsistências UX/UI
- Terminologia mista no menu/rotas (`Billing` em inglês no meio do restante PT-BR).
- Grande quantidade de aliases mantém compatibilidade, mas dificulta previsibilidade de deeplink e telemetria limpa por URL canônica.

### 7) Riscos técnicos
- Erro silencioso explícito no backend: `catch {}` em reconexão do WhatsApp service durante disconnect Prisma.
- Dependência de mock provider de WhatsApp permanece como default em partes do stack (observável também em migração e docs), elevando risco de ambiente de produção operar com comportamento de simulação se variável estiver incorreta.

## Lista de arquivos suspeitos (prioridade alta)
- `apps/web/vite.config.ts` (resíduos Manus + logging collector).
- `apps/web/client/public/__manus__/debug-collector.js` (acoplamento de debug específico).
- `apps/web/server/routers/contact.ts` (handlers placeholder/parciais).
- `apps/web/server/_core/sdk.ts` (placeholder explícito).
- `apps/web/server/auth.logout.test.ts` (teste placeholder).
- `apps/web/server/modals.test.ts` (teste placeholder).
- `apps/web/client/src/pages/CustomersPage.tsx` (stress-lab habilitável por URL).
- `apps/api/src/whatsapp/whatsapp.service.ts` (`catch {}` silencioso).
- `apps/web/todo.md` (pendências abertas no repo principal sem governança de backlog no tracker).

## Pode remover com segurança (rodada 1)
- Arquivos de backup/snapshot versionados sem uso de runtime:
  - `package.json.bak`
  - `apps/web/client/src/components/EditCustomerModal.tsx.save`
  - `apps/web/client/src/components/MainLayout.tsx.save`
  - `apps/web/client/src/lib/operations/operations.utils.ts.save`
  - `apps/web/vite.config.ts.save`
  - `prisma/seed-pilot.ts.save`
- Acrescentar regra de higiene no gitignore raiz para prevenir recorrência (`*.bak`, `*.save`).

## Precisa corrigir antes de remover
- Rotas legacy no `App.tsx`: remover só após auditoria de acessos (analytics/log de hits por path por 30 dias).
- Routers BFF suspeitos sem consumo: confirmar uso por integrações externas/tests E2E antes de excluir.
- `contactRouter`: migrar para persistência real antes de remover endpoints placeholder para não quebrar fluxo de modal/timeline.
- `vite-plugin-manus-runtime`/coletor Manus: retirar em fase controlada (com smoke de devtools/logging e suporte interno), pois pode haver dependência operacional de suporte.

## Ordem recomendada de limpeza
1. **Higiene de repositório**: remover `.save`/`.bak` + endurecer `.gitignore`.
2. **Confiabilidade de testes**: trocar placeholders por testes reais (logout cookie clearing, modal submit handlers).
3. **Consistência funcional**: eliminar/reescrever handlers placeholder de contato e sdk placeholder.
4. **Racionalização de rotas**: instrumentar e depois desativar aliases legacy com janela de depreciação.
5. **Limpeza BFF/API**: remover routers sem consumo confirmado e consolidar contratos frontend↔BFF↔API.
6. **Remoção Manus**: desativar plugin/coletor e validar observabilidade alternativa.
7. **Passo final**: revisão de dependências/scripts/envs com ferramenta dedicada (depcheck/knip) em ambiente com acesso ao registry.

## Implementação realizada nesta rodada
- Removidos 6 arquivos herdados de backup/snapshot (`.save`/`.bak`) sem impacto no runtime.
- Atualizado `.gitignore` raiz para bloquear reincidência (`*.bak`, `*.save`).

## Observações de tooling
- Tentativa de executar `depcheck` falhou por restrição de acesso ao registry (`ERR_PNPM_FETCH_403`), então o bloco de dependências não usadas fica como diagnóstico **suspeito** para próxima rodada em ambiente autorizado.
