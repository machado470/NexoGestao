import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getErrorMessage, getPayloadValue, getQueryUiState } from "@/lib/query-helpers";
import { useAuth } from "@/contexts/AuthContext";
import { PageHero, PageShell, SurfaceSection } from "@/components/PagePattern";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoEnvironmentCta } from "@/components/DemoEnvironmentCta";

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}

export default function GovernancePage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const [, navigate] = useLocation();
  const canLoadGovernance = isAuthenticated;

  const summaryQuery = trpc.governance.summary.useQuery(undefined, {
    enabled: canLoadGovernance,
    retry: false,
  });
  const runsQuery = trpc.governance.runs.useQuery({ limit: 20 }, { enabled: canLoadGovernance, retry: false });
  const autoScoreQuery = trpc.governance.autoScore.useQuery(undefined, { enabled: canLoadGovernance, retry: false });
  const alertsQuery = trpc.dashboard.alerts.useQuery(undefined, { enabled: canLoadGovernance, retry: false });

  const summary = useMemo(() => {
    const payload = getPayloadValue<any>(summaryQuery.data);
    return payload && typeof payload === "object" ? payload : null;
  }, [summaryQuery.data]);

  const autoScore = useMemo(() => {
    const payload = getPayloadValue<any>(autoScoreQuery.data);
    return payload && typeof payload === "object" ? payload : null;
  }, [autoScoreQuery.data]);

  const runs = useMemo(() => {
    const payload = getPayloadValue<any>(runsQuery.data);
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  }, [runsQuery.data]);

  const alerts = useMemo(() => {
    const payload = getPayloadValue<any>(alertsQuery.data);
    return payload && typeof payload === "object" ? payload : null;
  }, [alertsQuery.data]);

  const institutionalRiskScore = clamp(
    Number(summary?.institutionalRiskScore ?? autoScore?.institutionalRiskScore ?? autoScore?.score ?? 0)
  );
  const financialScore = clamp(100 - Number(summary?.financialRiskScore ?? autoScore?.financialRiskScore ?? 0));
  const operationScore = clamp(100 - Number(summary?.operationalRiskScore ?? autoScore?.operationalRiskScore ?? 0));
  const communicationScore = clamp(100 - Number(summary?.communicationRiskScore ?? autoScore?.communicationRiskScore ?? 0));
  const [actionRoutingId, setActionRoutingId] = useState<string | null>(null);

  const hasAnyData =
    summaryQuery.data !== undefined ||
    runsQuery.data !== undefined ||
    autoScoreQuery.data !== undefined ||
    alertsQuery.data !== undefined;

  const queryState = getQueryUiState([summaryQuery, runsQuery, autoScoreQuery, alertsQuery], hasAnyData);

  const hasError = summaryQuery.isError || runsQuery.isError || autoScoreQuery.isError || alertsQuery.isError;
  const errorMessage =
    getErrorMessage(summaryQuery.error, "") ||
    getErrorMessage(runsQuery.error, "") ||
    getErrorMessage(autoScoreQuery.error, "") ||
    getErrorMessage(alertsQuery.error, "") ||
    "Erro ao carregar governança";

  const whyScore = [
    financialScore < 70 ? "Financeiro pressionado por cobranças pendentes/vencidas." : "Financeiro estável sem pressão crítica.",
    operationScore < 70 ? "Operação com fila acumulada e risco de atraso." : "Operação com ritmo controlado.",
    communicationScore < 70
      ? "Comunicação reativa: contatos de cobrança/confirmação insuficientes."
      : "Comunicação com boa cadência no fluxo.",
  ];

  const actionPlan = [
    {
      id: "os",
      title: "Destravar execução pendente",
      description: "Abrir O.S. em andamento e reduzir fila operacional.",
      cta: "Ir para O.S.",
      onClick: () => navigate("/service-orders"),
    },
    {
      id: "finance",
      title: "Atacar vencimentos",
      description: "Priorizar cobranças vencidas para proteger caixa.",
      cta: "Ir para cobranças",
      onClick: () => navigate("/finances"),
    },
    {
      id: "wa",
      title: "Aumentar cadência de comunicação",
      description: "Executar contatos operacionais e de recuperação no WhatsApp.",
      cta: "Ir para WhatsApp",
      onClick: () => navigate("/whatsapp"),
    },
  ];

  const scoreTone =
    institutionalRiskScore < 50
      ? "critical"
      : institutionalRiskScore < 75
        ? "attention"
        : "healthy";

  if (isInitializing) {
    return <PageShell><PageHero eyebrow="Governança" title="Governança" description="Validando sessão e permissões." /><SurfaceSection className="flex min-h-[180px] items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" />Carregando sessão...</SurfaceSection></PageShell>;
  }

  if (!isAuthenticated) {
    return <PageShell><PageHero eyebrow="Governança" title="Governança" description="Sua sessão não está ativa." /></PageShell>;
  }

  if (queryState.isInitialLoading) {
    return <PageShell><PageHero eyebrow="Governança" title="Governança" description="Montando leitura institucional de risco." /><SurfaceSection className="flex min-h-[180px] items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" />Carregando governança...</SurfaceSection></PageShell>;
  }

  if (queryState.shouldBlockForError) {
    return <PageShell><PageHero eyebrow="Governança" title="Governança" description="Não foi possível montar os blocos de governança." /><SurfaceSection className="border-red-200 text-red-700 dark:border-red-900/40 dark:text-red-300">{errorMessage}</SurfaceSection></PageShell>;
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Governança"
        title="Governança Operacional"
        description="Painel executivo guiado: score institucional, explicação causal e plano de ação direto por módulo."
        actions={<Button onClick={() => navigate("/dashboard/operations")}>Ver operação</Button>}
      />

      <div
        className={`nexo-surface p-6 text-center ${
          scoreTone === "critical"
            ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"
            : scoreTone === "attention"
              ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
              : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
        }`}
      >
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-300">Score principal</p>
        <p className="mt-2 text-5xl font-bold text-zinc-900 dark:text-zinc-100">{institutionalRiskScore}</p>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          {scoreTone === "critical"
            ? "Risco alto: trate gargalos críticos agora para proteger caixa e operação."
            : scoreTone === "attention"
              ? "Atenção operacional: existem pontos de risco pedindo ajuste imediato."
              : "Saúde estável: mantenha disciplina para preservar o ritmo do fluxo."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SurfaceSection><p className="text-xs uppercase text-zinc-500">Financeiro</p><p className="mt-1 text-3xl font-bold">{financialScore}</p></SurfaceSection>
        <SurfaceSection><p className="text-xs uppercase text-zinc-500">Operação</p><p className="mt-1 text-3xl font-bold">{operationScore}</p></SurfaceSection>
        <SurfaceSection><p className="text-xs uppercase text-zinc-500">Comunicação</p><p className="mt-1 text-3xl font-bold">{communicationScore}</p></SurfaceSection>
      </div>

      <SurfaceSection className="space-y-2">
        <h2 className="font-semibold">Por que o score está assim?</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
          {whyScore.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </SurfaceSection>

      <SurfaceSection className="space-y-3">
        <h2 className="font-semibold">Plano de ação</h2>
        <div className="space-y-2">
          {actionPlan.map((item) => (
            <div key={item.id} className="nexo-subtle-surface flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.description}</p>
              </div>
              <Button
                onClick={() => {
                  setActionRoutingId(item.id);
                  item.onClick();
                }}
              >
                {actionRoutingId === item.id ? "Abrindo..." : item.cta}
              </Button>
            </div>
          ))}
        </div>
      </SurfaceSection>

      {hasError ? (
        <SurfaceSection className="border-amber-500/30 bg-amber-500/10 text-sm text-amber-200">{errorMessage}</SurfaceSection>
      ) : null}

      {runs.length > 0 ? (
        <SurfaceSection className="space-y-2">
          <h2 className="font-semibold">Histórico recente</h2>
          {runs.slice(0, 5).map((run: any) => (
            <div key={run.id} className="rounded border p-3 text-sm">
              {formatDate(run.createdAt)} · Score {Number(run.institutionalRiskScore ?? run.score ?? 0)}
            </div>
          ))}
        </SurfaceSection>
      ) : (
        <SurfaceSection className="space-y-3">
          <EmptyState
            icon={<ShieldAlert className="h-7 w-7" />}
            title="Histórico de governança ainda vazio"
            description="Assim que a operação gerar eventos de risco e controle, este bloco exibirá a evolução do score."
            action={{ label: "Atualizar governança", onClick: () => void runsQuery.refetch() }}
          />
          <DemoEnvironmentCta />
        </SurfaceSection>
      )}

      {alerts?.total ? (
        <SurfaceSection className="text-sm text-zinc-500 dark:text-zinc-400">
          Alertas monitorados: {Number(alerts.total ?? 0)}
        </SurfaceSection>
      ) : null}
    </PageShell>
  );
}
