import { transientReadOptions } from "@/lib/read-query-retry";
import { AppStatusBadge as StateBadge } from "@/components/app-system";
import { MobileModuleHeader } from "@/components/MobileModuleHeader";
import { ResponsiveDetails } from "@/components/ResponsiveDetails";
import { useOrganizationLocale } from "@/contexts/OrganizationLocaleContext";
import { formatOrganizationDate, type Instant } from "@/lib/organization-locale";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { can, type Permission } from "@/lib/rbac";
import { presentationLabel } from "@/lib/presentation-labels";
import { useLocation } from "wouter";
import { ArrowRight, Clock3, FileCheck2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AppAlert,
  AppAlertDescription,
  AppAlertTitle,
  AppPageShell,
} from "@/components/app-system";
import {
  AppOperationalHeader,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { setBootPhase } from "@/lib/bootPhase";
import { trpc } from "@/lib/trpc";

const STATE_LABELS = {
  NORMAL: "Operação normal",
  WARNING: "Operação em atenção",
  RESTRICTED: "Operação restrita",
  SUSPENDED: "Operação suspensa",
  UNKNOWN: "Estado não informado",
} as const;


const STATE_TONES = { NORMAL: "success", WARNING: "warning", RESTRICTED: "danger", SUSPENDED: "danger", UNKNOWN: "neutral" } as const;

function sourceLabel(source: string | undefined) {
  if (!source) return "Não informada";
  const labels: Record<string, string> = {
    NO_DATA: "Sem dados avaliáveis",
    RISK_ENGINE: "Motor de risco",
    GOVERNANCE_RUN: "Execução de governança",
    PERSISTED_OPERATIONAL_STATE: "Estado operacional persistido",
    UNAVAILABLE: "Fonte indisponível",
  };
  return labels[source] ?? presentationLabel(source);
}

export default function GovernancePage() {
  const { timezone } = useOrganizationLocale();
  const formatDate = (value: unknown) => formatOrganizationDate(value as Instant, timezone, "Não informada", {dateStyle:"short",timeStyle:"medium"});
  setBootPhase("PAGE:Governança");
  useRenderWatchdog("GovernancePage");
  const [, navigate] = useLocation();
  const [showAllSignals, setShowAllSignals] = useState(false);
  const { role, isAuthenticated } = useAuth();

  const stateQuery = trpc.governance.operationalState.useQuery(undefined, {
    enabled: isAuthenticated, ...transientReadOptions,
  });
  const scoreQuery = trpc.governance.autoScore.useQuery(undefined, {
    enabled: isAuthenticated, ...transientReadOptions,
  });
  const runsQuery = trpc.governance.runs.useQuery(
    { limit: 12 },
    { enabled: isAuthenticated, ...transientReadOptions }
  );
  const signalsQuery = trpc.dashboard.operationalSignals.useQuery(
    { limit: 50 },
    { enabled: isAuthenticated, ...transientReadOptions }
  );
  const nextActionQuery = trpc.dashboard.nextBestAction.useQuery(undefined, {
    enabled: isAuthenticated, ...transientReadOptions,
  });

  const stateLoading = stateQuery.isLoading || (stateQuery.isFetching && stateQuery.isError);
  const scoreLoading = scoreQuery.isLoading || (scoreQuery.isFetching && scoreQuery.isError);
  const runsLoading = runsQuery.isLoading || (runsQuery.isFetching && runsQuery.isError);
  const signalsLoading = signalsQuery.isLoading || (signalsQuery.isFetching && signalsQuery.isError);
  const nextActionLoading = nextActionQuery.isLoading || (nextActionQuery.isFetching && nextActionQuery.isError);

  const queries = [
    stateQuery,
    scoreQuery,
    runsQuery,
    signalsQuery,
    nextActionQuery,
  ];
  const unavailable = queries.filter(query => query.isError && !query.isFetching).length;
  const refresh = () => void Promise.allSettled(queries.map(query => query.refetch()));
  const retryUnavailable = () =>
    void Promise.allSettled(
      queries.filter(query => query.isError && !query.isFetching).map(query => query.refetch())
    );
  const routePermissions: Record<string, Permission> = { "/finances": "finance:read", "/service-orders": "orders:read", "/governance": "governance:read", "/timeline": "reports:read" };
  const stateData = stateQuery.data;
  const state = stateData?.operationalState;
  const nextAction = nextActionQuery.data;
  const destination = nextAction?.routeHint.split("?")[0];
  const canOpenNextAction = Boolean(role && destination && (destination === "/whatsapp" || (routePermissions[destination] && can(role, routePermissions[destination]))));
  const staleEvaluation = signalsQuery.data?.signals.some(signal => signal.reason === "GOVERNANCE_RUN_STALE") ?? false;

  return (
    <AppPageShell className="operational-mobile-page mobile-module-page evidence-mobile-page gap-4">
      <MobileModuleHeader title="Governança" description="Situação, alertas e próximas ações." context={stateLoading ? "Consultando a operação…" : stateQuery.isError ? "Leitura indisponível" : undefined} onRefresh={refresh} />
      <div className="hidden md:block">
      <AppOperationalHeader
        title="Governança e risco operacional"
        description="Estado, razões, sinais, decisões e execuções fornecidos pelas fontes oficiais — somente leitura."
        primaryAction={
          <Button
            variant="outline"
            onClick={refresh}
            disabled={queries.some(query => query.isFetching)}
            aria-label="Atualizar fontes oficiais de governança"
          >
            <RefreshCw className="mr-2 size-4" aria-hidden="true" />
            Atualizar
          </Button>
        }
        contextChips={
          stateLoading ? (
            <AppStatusBadge label="Carregando estado oficial" />
          ) : stateQuery.isError || !state ? (
            <AppStatusBadge label="Estado oficial indisponível" />
          ) : stateData?.availability === "NO_DATA" ? (
            <AppStatusBadge label="Sem avaliação" />
          ) : (
            <>
              <AppStatusBadge label={STATE_LABELS[state]} />
              <span className="text-xs text-[var(--text-muted)]">
                Referência: {formatDate(stateData?.evidenceAt)}
              </span>
            </>
          )
        }
      />
      </div>

      {unavailable > 0 ? (
        <AppAlert role="status">
          <AppAlertTitle>Indisponibilidade parcial</AppAlertTitle>
          <AppAlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {unavailable} fonte(s) não responderam. Falhas não são tratadas
              como ausência de risco nem como estado normal.
            </span>
            <Button variant="outline" size="sm" className="min-h-11" onClick={retryUnavailable}>
              Tentar novamente
            </Button>
          </AppAlertDescription>
        </AppAlert>
      ) : null}

      <AppSectionBlock
        className="governance-state"
        title="Situação atual"
        compact
      >
        {stateLoading ? (
          <AppPageLoadingState
            title="Carregando estado oficial"
            description="Consultando a decisão operacional vigente."
          />
        ) : stateQuery.isError ? (
          <AppPageErrorState
            title="Estado operacional indisponível"
            description="A fonte autoritativa não respondeu. Nenhum estado foi presumido."
            actionLabel="Tentar novamente"
            onAction={() => void stateQuery.refetch()}
          />
        ) : !stateQuery.data ? (
          <AppPageEmptyState
            title="Contrato de estado indisponível"
            description="A consulta terminou sem um contrato de decisão operacional utilizável."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0">
              <StateBadge
                label={STATE_LABELS[stateQuery.data.operationalState]}
                tone={STATE_TONES[stateQuery.data.operationalState]}
              />
              <h2 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">
                {stateQuery.data.reason ?? "Justificativa não informada"}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Origem: {sourceLabel(stateQuery.data.source)}
              </p>
            </div>
            <ResponsiveDetails title="Contexto da avaliação" controls>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Referência</dt>
                <dd className="break-words font-medium text-[var(--text-primary)]">
                  {formatDate(stateQuery.data.evidenceAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--text-muted)]">
                  Registros avaliados
                </dt>
                <dd className="font-medium text-[var(--text-primary)]">
                  {stateQuery.data.evaluatedRecords}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--text-muted)]">
                  Disponibilidade oficial
                </dt>
                <dd className="break-words font-medium text-[var(--text-primary)]">
                  {presentationLabel(stateQuery.data.availability)}
                </dd>
              </div>
            </dl>
            </ResponsiveDetails>
          </div>
        )}
      </AppSectionBlock>

      <AppSectionBlock className="mobile-flat-section" title="Última avaliação" subtitle="Referência da avaliação concluída retornada pela API.">
        <p className="text-sm text-[var(--text-secondary)]" role="status">{stateLoading ? "Carregando avaliação..." : stateQuery.isError ? "Avaliação indisponível." : stateData?.availability === "NO_DATA" ? "Nenhuma avaliação concluída com dados disponíveis." : stateData?.evidenceAt ? `Avaliação em ${formatDate(stateData.evidenceAt)}. ${staleEvaluation ? "Avaliação desatualizada conforme diagnóstico oficial." : signalsLoading ? "Consultando a atualidade da avaliação…" : signalsQuery.isError ? "Não foi possível verificar a atualidade da avaliação." : "Sem indicação de desatualização no recorte oficial."}` : "Data da avaliação não informada pela fonte."}</p>
      </AppSectionBlock>
      <div className="grid gap-4 xl:grid-cols-2">
        <AppSectionBlock
          className="governance-next-action"
          title="Próxima ação"
          subtitle="Próxima ação oficial; abrir o destino não executa a ação automaticamente."
        >
          {nextActionLoading ? (
            <AppPageLoadingState title="Carregando decisão oficial" />
          ) : nextActionQuery.isError ? (
            <AppPageErrorState
              title="Decisão indisponível"
              description="A recomendação oficial não pôde ser consultada."
              actionLabel="Tentar novamente"
              onAction={() => void nextActionQuery.refetch()}
            />
          ) : !nextAction ? (
            <AppPageEmptyState
              title="Sem recomendação ativa"
              description="A fonte respondeu sem próxima ação oficial. Isso não representa uma ação executada."
            />
          ) : (
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StateBadge label={presentationLabel(nextAction.area)} tone="neutral" />
                <span className="break-all text-xs text-[var(--text-muted)]">
                  Origem: {sourceLabel(nextAction.source)}
                </span>
              </div>
              <h3 className="mt-3 break-words font-semibold text-[var(--text-primary)]">
                {nextAction.title}
              </h3>
              <p className="mt-2 break-words text-sm text-[var(--text-secondary)]">
                <strong>Razão:</strong> {nextAction.reason}
              </p>
              <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">
                <strong>Impacto:</strong> {nextAction.impact}
              </p>
              <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">
                <strong>Recomendação:</strong> {nextAction.suggestedAction}
              </p>
              <Button
                className="mt-4 h-auto min-h-11 max-w-full whitespace-normal break-words"
                disabled={!canOpenNextAction}
                onClick={() => destination === "/governance" ? refresh() : navigate(nextAction.routeHint)}
                aria-label={`Abrir destino oficial: ${nextAction.title}`}
              >
                {canOpenNextAction ? destination === "/governance" ? "Atualizar fontes" : "Ver próximo passo" : "Destino restrito ao seu perfil"}
                <ArrowRight className="ml-2 size-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </AppSectionBlock>

        <ResponsiveDetails title="Avaliação automática" controls>
        <AppSectionBlock
          title="Avaliação automática oficial"
          subtitle="Nota e fatores já calculados pelo backend; não determina o estado operacional exibido acima."
        >
          {scoreLoading ? (
            <AppPageLoadingState title="Carregando avaliação oficial" />
          ) : scoreQuery.isError ? (
            <AppPageErrorState
              title="Avaliação indisponível"
              description="A fonte da avaliação automática não respondeu."
              actionLabel="Tentar novamente"
              onAction={() => void scoreQuery.refetch()}
            />
          ) : !scoreQuery.data || scoreQuery.data.availability === "NO_DATA" ? (
            <AppPageEmptyState
              title="Sem avaliação disponível"
              description={
                scoreQuery.data?.reason ??
                "A fonte respondeu sem dados avaliáveis."
              }
            />
          ) : (
            <div>
              <p className="text-3xl font-semibold text-[var(--text-primary)]">
                {scoreQuery.data.level ?? "Sem classificação"}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                Nota oficial: {scoreQuery.data.score ?? "Não informada"}/100 ·{" "}
                {sourceLabel(scoreQuery.data.source)}
              </p>
              <dl className="mt-4 divide-y divide-[var(--border-subtle)]">
                {scoreQuery.data.factors.map(factor => (
                  <div
                    key={factor.name}
                    className="grid gap-1 py-2 sm:grid-cols-[1fr_auto] sm:gap-4"
                  >
                    <dt className="break-words text-sm text-[var(--text-secondary)]">
                      {factor.name}
                    </dt>
                    <dd className="break-words text-sm font-medium text-[var(--text-primary)] sm:text-right">
                      {factor.value == null ? "Sem sinal" : presentationLabel(factor.value)}
                      <span className="block text-xs font-normal text-[var(--text-muted)]">
                        {factor.reference}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </AppSectionBlock>
        </ResponsiveDetails>
      </div>

      <AppSectionBlock
        title="Sinais e evidências"
        subtitle="Sinais na ordem fornecida pelo backend, sem reclassificação, pontuação ou ordenação no navegador."
      >
        {signalsLoading ? (
          <AppPageLoadingState title="Carregando sinais oficiais" />
        ) : signalsQuery.isError ? (
          <AppPageErrorState
            title="Sinais indisponíveis"
            description="Não é possível afirmar que não há sinais enquanto a fonte estiver indisponível."
            actionLabel="Tentar novamente"
            onAction={() => void signalsQuery.refetch()}
          />
        ) : (signalsQuery.data?.signals.length ?? 0) === 0 ? (
          <AppPageEmptyState
            title="Nenhum sinal retornado"
            description="A fonte respondeu sem sinais operacionais ativos."
          />
        ) : (
          <ol
            className="divide-y divide-[var(--border-subtle)]"
            id="governance-signals"
            aria-label="Sinais operacionais oficiais"
          >
            {signalsQuery.data?.signals.map((signal, index) => (
              <li key={signal.id} className={`min-w-0 py-4 first:pt-0 last:pb-0 ${index > 2 && !showAllSignals ? "hidden md:block" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <AppStatusBadge label={presentationLabel(signal.severity)} />
                  <span className="text-xs text-[var(--text-muted)]">
                    {presentationLabel(signal.area)}
                  </span>
                </div>
                <h3 className="mt-2 break-words font-semibold text-[var(--text-primary)]">
                  {signal.title}
                </h3>
                {signal.reason ? (
                  <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">
                    <strong>Razão:</strong> {presentationLabel(signal.reason)}
                  </p>
                ) : null}
                {signal.summary ? (
                  <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">
                    {signal.summary}
                  </p>
                ) : null}
                {signal.impact ? (
                  <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">
                    <strong>Impacto informado:</strong> {signal.impact}
                  </p>
                ) : null}
                <ResponsiveDetails title="Origem e referência" controls>
                <p className="mt-2 break-all text-xs text-[var(--text-muted)]">
                  Origem: {sourceLabel(signal.source)} · ID: {signal.id}
                  {signal.detectedAt
                    ? ` · Detectado em ${formatDate(signal.detectedAt)}`
                    : ""}
                </p>
                </ResponsiveDetails>
              </li>
            ))}
          </ol>
        )}
        {(signalsQuery.data?.signals.length ?? 0) > 3 ? <button type="button" className="mt-3 min-h-11 text-sm font-medium text-[var(--nx-brand-text,var(--accent-primary))] md:hidden" aria-expanded={showAllSignals} aria-controls="governance-signals" onClick={() => setShowAllSignals(value => !value)}>{showAllSignals ? "Mostrar menos sinais" : "Ver todos os sinais"}</button> : null}
      </AppSectionBlock>

      <ResponsiveDetails title="Histórico de avaliações" controls>
      <AppSectionBlock
        title="Histórico de execuções"
        subtitle="Execuções de governança na ordem oficial. O contrato atual não fornece ator, transição de estado ou razão por execução."
        ctaLabel="Abrir Timeline"
        onCtaClick={() => navigate("/timeline?module=governance")}
      >
        {runsLoading ? (
          <AppPageLoadingState title="Carregando execuções oficiais" />
        ) : runsQuery.isError ? (
          <AppPageErrorState
            title="Histórico indisponível"
            description="A falha da fonte não foi substituída por uma lista vazia."
            actionLabel="Tentar novamente"
            onAction={() => void runsQuery.refetch()}
          />
        ) : (runsQuery.data?.length ?? 0) === 0 ? (
          <AppPageEmptyState
            title="Nenhuma execução registrada"
            description="A fonte respondeu, mas ainda não há execução oficial de governança."
          />
        ) : (
          <ol
            className="divide-y divide-[var(--border-subtle)]"
            aria-label="Execuções oficiais de governança"
          >
            {runsQuery.data?.map(run => (
              <li
                key={run.id}
                className="grid min-w-0 gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
              >
                <FileCheck2
                  className="size-5 text-[var(--nx-brand-text,var(--accent-primary))]"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="break-all font-medium text-[var(--text-primary)]">
                    Execução {run.id}
                  </p>
                  <p className="break-words text-sm text-[var(--text-secondary)]">
                    Resultado informado: {run.evaluated} avaliados ·{" "}
                    {run.warnings} alertas · {run.correctives} corretivas ·
                    risco institucional {run.institutionalRiskScore}
                  </p>
                  <p className="mt-1 break-all text-xs text-[var(--text-muted)]">
                    Referência: {run.bucket}
                  </p>
                </div>
                <time
                  className="text-xs text-[var(--text-muted)]"
                  dateTime={run.finishedAt}
                >
                  <Clock3 className="mr-1 inline size-3" aria-hidden="true" />
                  {formatDate(run.finishedAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </AppSectionBlock>
      </ResponsiveDetails>

      <AppAlert>
        <AppAlertTitle>Limites do contrato atual</AppAlertTitle>
        <AppAlertDescription>
          Não há política informativa, ator, estado anterior/posterior, razão
          por execução nem destino por sinal nos contratos consumidos. Esses
          dados são omitidos; a interface não os reconstrói.
        </AppAlertDescription>
      </AppAlert>
    </AppPageShell>
  );
}
