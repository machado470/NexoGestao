import React, { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";

function formatDate(value?: string | Date | null) {
  if (!value) return "N/A";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleString("pt-BR");
}

function formatRiskLevel(score?: number | null) {
  const value = Number(score ?? 0);

  if (value >= 80) return "Crítico";
  if (value >= 60) return "Alto";
  if (value >= 40) return "Moderado";
  if (value > 0) return "Baixo";
  return "Sem score";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }

  return fallback;
}

export default function GovernancePage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canLoadGovernance = isAuthenticated && !isInitializing;

  const summaryQuery = trpc.governance.summary.useQuery(undefined, {
    enabled: canLoadGovernance,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const runsQuery = trpc.governance.runs.useQuery(
    { limit: 20 },
    {
      enabled: canLoadGovernance,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const autoScoreQuery = trpc.governance.autoScore.useQuery(undefined, {
    enabled: canLoadGovernance,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const summary = useMemo(() => {
    const payload: any = summaryQuery.data;
    return payload?.data ?? payload ?? null;
  }, [summaryQuery.data]);

  const runs = useMemo(() => {
    const payload: any = runsQuery.data;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload)) return payload;
    return [];
  }, [runsQuery.data]);

  const autoScore = useMemo(() => {
    const payload: any = autoScoreQuery.data;
    return payload?.data ?? payload ?? null;
  }, [autoScoreQuery.data]);

  const isLoading =
    summaryQuery.isLoading || runsQuery.isLoading || autoScoreQuery.isLoading;

  const hasError =
    summaryQuery.isError || runsQuery.isError || autoScoreQuery.isError;

  const errorMessage =
    getErrorMessage(summaryQuery.error, "") ||
    getErrorMessage(runsQuery.error, "") ||
    getErrorMessage(autoScoreQuery.error, "") ||
    "Não foi possível carregar a governança agora.";

  if (isInitializing) {
    return (
      <div className="p-6 space-y-6">
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          Carregando sessão...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 space-y-6">
        <div className="rounded-2xl border p-4 text-sm text-zinc-500 dark:border-zinc-800">
          Faça login para visualizar a governança.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          Carregando...
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="p-6 space-y-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-semibold">Governança</h1>
        <p className="text-sm opacity-70">
          Visão consolidada dos ciclos de governança, risco institucional e execuções recentes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Última execução</div>
          <div className="mt-2 text-sm font-medium">
            {formatDate(summary?.lastRunAt)}
          </div>
        </div>

        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Score institucional</div>
          <div className="mt-2 text-2xl font-semibold">
            {Number(summary?.institutionalRiskScore ?? 0)}
          </div>
          <div className="text-xs opacity-70">
            {formatRiskLevel(summary?.institutionalRiskScore)}
          </div>
        </div>

        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Itens avaliados</div>
          <div className="mt-2 text-2xl font-semibold">
            {Number(summary?.evaluated ?? 0)}
          </div>
          <div className="text-xs opacity-70">
            Warnings: {Number(summary?.warnings ?? 0)}
          </div>
        </div>

        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Ações corretivas</div>
          <div className="mt-2 text-2xl font-semibold">
            {Number(summary?.correctives ?? 0)}
          </div>
          <div className="text-xs opacity-70">
            Em aberto: {Number(summary?.openCorrectivesCount ?? 0)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Restritos</div>
          <div className="mt-2 text-2xl font-semibold">
            {Number(summary?.restrictedCount ?? 0)}
          </div>
        </div>

        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Suspensos</div>
          <div className="mt-2 text-2xl font-semibold">
            {Number(summary?.suspendedCount ?? 0)}
          </div>
        </div>

        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Duração do último ciclo</div>
          <div className="mt-2 text-2xl font-semibold">
            {Number(summary?.durationMs ?? 0)} ms
          </div>
        </div>
      </div>

      <div className="rounded-2xl border p-4 dark:border-zinc-800">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Auto Score</h2>
          <p className="text-sm opacity-70">
            Score automático consolidado por domínio.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border p-3 dark:border-zinc-800">
            <div className="text-sm opacity-70">Score</div>
            <div className="mt-1 text-2xl font-semibold">
              {Number(autoScore?.score ?? 0)}
            </div>
          </div>

          <div className="rounded-xl border p-3 dark:border-zinc-800">
            <div className="text-sm opacity-70">Nível</div>
            <div className="mt-1 text-2xl font-semibold">
              {autoScore?.level ?? "N/A"}
            </div>
          </div>

          <div className="rounded-xl border p-3 dark:border-zinc-800">
            <div className="text-sm opacity-70">Última atualização</div>
            <div className="mt-1 text-sm font-medium">
              {formatDate(autoScore?.lastUpdated)}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {Array.isArray(autoScore?.factors) && autoScore.factors.length > 0 ? (
            autoScore.factors.map((factor: any, index: number) => (
              <div
                key={`${factor?.name ?? "factor"}-${index}`}
                className="flex items-center justify-between rounded-xl border p-3 dark:border-zinc-800"
              >
                <div className="font-medium">{factor?.name ?? "Fator"}</div>
                <div className="text-sm opacity-80">
                  Score: {Number(factor?.score ?? 0)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm opacity-70">
              Nenhum fator de auto score disponível.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border p-4 dark:border-zinc-800">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Histórico de execuções</h2>
          <p className="text-sm opacity-70">
            Últimos ciclos registrados de governança.
          </p>
        </div>

        {runs.length === 0 ? (
          <div className="text-sm opacity-70">Nenhuma execução encontrada.</div>
        ) : (
          <div className="space-y-3">
            {runs.map((run: any) => (
              <div
                key={run.id ?? `${run.createdAt}-${run.orgId}`}
                className="rounded-xl border p-3 dark:border-zinc-800"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">
                      Execução em {formatDate(run.createdAt)}
                    </div>
                    <div className="text-sm opacity-70">
                      Score institucional: {Number(run.institutionalRiskScore ?? 0)}
                    </div>
                    <div className="text-sm opacity-70">
                      Avaliados: {Number(run.evaluated ?? 0)} • Warnings: {Number(run.warnings ?? 0)} • Corretivas: {Number(run.correctives ?? 0)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm md:min-w-[260px]">
                    <div className="rounded border p-2 dark:border-zinc-800">
                      Restritos: {Number(run.restrictedCount ?? 0)}
                    </div>
                    <div className="rounded border p-2 dark:border-zinc-800">
                      Suspensos: {Number(run.suspendedCount ?? 0)}
                    </div>
                    <div className="rounded border p-2 dark:border-zinc-800">
                      Corretivas abertas: {Number(run.openCorrectivesCount ?? 0)}
                    </div>
                    <div className="rounded border p-2 dark:border-zinc-800">
                      Duração: {Number(run.durationMs ?? 0)} ms
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border p-4 dark:border-zinc-800">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Tendência recente</h2>
          <p className="text-sm opacity-70">
            Últimos pontos retornados no resumo de governança.
          </p>
        </div>

        {Array.isArray(summary?.trend) && summary.trend.length > 0 ? (
          <div className="space-y-2">
            {summary.trend.map((item: any, index: number) => (
              <div
                key={`${item?.createdAt ?? "trend"}-${index}`}
                className="flex flex-col gap-1 rounded-xl border p-3 dark:border-zinc-800 md:flex-row md:items-center md:justify-between"
              >
                <div className="font-medium">{formatDate(item?.createdAt)}</div>
                <div className="text-sm opacity-70">
                  Score: {Number(item?.institutionalRiskScore ?? 0)}
                </div>
                <div className="text-sm opacity-70">
                  Avaliados: {Number(item?.evaluated ?? 0)}
                </div>
                <div className="text-sm opacity-70">
                  Warnings: {Number(item?.warnings ?? 0)}
                </div>
                <div className="text-sm opacity-70">
                  Corretivas: {Number(item?.correctives ?? 0)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm opacity-70">Sem dados de tendência no momento.</div>
        )}
      </div>
    </div>
  );
}
