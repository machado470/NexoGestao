import { useRef, useState, type Ref } from "react";
import { Eye, EyeOff, Loader2, Network, RefreshCw, ShieldCheck, ShieldQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AppOperationalHeader,
  AppPageErrorState,
  AppPageLoadingState,
  AppPageShell,
  AppSectionBlock,
} from "@/components/internal-page-system";
import { AppSectionCard, AppStatCard, AppStatusBadge } from "@/components/app-system";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  DIAGNOSTIC_ERROR_TEXT,
  DIAGNOSTIC_STATUS_TEXT,
  buildIpDiagnosticView,
  diagnosticErrorKind,
  resolveDiagnosticQueryState,
  yesNoLabel,
  type DiagnosticErrorKind,
  type DiagnosticQueryState,
  type IpDiagnosticPayload,
  type IpDiagnosticView as View,
  type YesNo,
} from "./IpDiagnostic.logic";

export const HEADER_COINCIDENCE_DISCLAIMER =
  "Coincidência entre headers NÃO comprova que o IP de origem seja autêntico. Ela só mostra como esta requisição chegou ao BFF. Nenhum resultado desta tela é usado para autenticação, autorização ou rate limiting (política NO_TRUST).";

function yesNoTone(value: YesNo, expected: "yes" | "no" = "yes") {
  if (value === "na") return "neutral" as const;
  return value === expected ? ("success" as const) : ("warning" as const);
}

export function IpDiagnosticDisclaimer() {
  return (
    <AppSectionCard className="space-y-1" role="note" aria-label="Limites do diagnóstico">
      <p className="text-sm font-semibold text-[var(--text-primary)]">Somente diagnóstico</p>
      <p className="text-sm text-[var(--text-secondary)]">{HEADER_COINCIDENCE_DISCLAIMER}</p>
    </AppSectionCard>
  );
}

export function IpDiagnosticAccessState({ kind, onRetry }: { kind: DiagnosticErrorKind; onRetry: () => void }) {
  const text = DIAGNOSTIC_ERROR_TEXT[kind];
  return <AppPageErrorState title={text.title} description={text.description} actionLabel="Verificar novamente" onAction={onRetry} />;
}

/**
 * Status line right below the header (a manual check scrolls it into view on short screens).
 * It is the live region: "Verificando..." on every request and the time of the last completed check.
 */
export function IpDiagnosticStatus({ state, ref }: { state: DiagnosticQueryState; ref?: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-diagnostic-phase={state.phase}
      className="flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
    >
      {state.checking ? <Loader2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 motion-safe:animate-spin" /> : null}
      <span>{state.statusText}</span>
    </div>
  );
}

/**
 * Result area for every query phase. It is never empty: loading, paused (browser reports offline),
 * idle, error (specific 401/403/429/503/no-response texts) or the diagnostic itself.
 */
export function IpDiagnosticStateView({
  state,
  error,
  data,
  onRetry,
}: {
  state: DiagnosticQueryState;
  error: unknown;
  data: unknown;
  onRetry: () => void;
}) {
  if (state.phase === "loading") {
    return <AppPageLoadingState title="Consultando diagnóstico" description="Verificando a sua requisição e a autorização na API." />;
  }
  if (state.phase === "paused") {
    return <AppPageErrorState title="Verificação em espera" description={DIAGNOSTIC_STATUS_TEXT.paused} actionLabel="Verificar novamente" onAction={onRetry} />;
  }
  if (state.phase === "error") return <IpDiagnosticAccessState kind={diagnosticErrorKind(error)} onRetry={onRetry} />;
  if (state.phase === "success" && data) return <IpDiagnosticResult view={buildIpDiagnosticView(data as IpDiagnosticPayload)} />;
  return <AppPageErrorState title="Nenhum resultado ainda" description={DIAGNOSTIC_STATUS_TEXT.idle} actionLabel="Verificar novamente" onAction={onRetry} />;
}

export function IpDiagnosticResult({ view }: { view: View }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <AppStatusBadge label="Diagnóstico autorizado" tone="success" />
        <AppStatusBadge label={`Classificação: ${view.classification.label}`} tone={view.classification.tone} />
        <AppStatusBadge label={view.addressesMode === "full" ? "Endereços completos visíveis" : "Endereços parciais"} tone={view.addressesMode === "full" ? "warning" : "neutral"} />
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{view.classification.description}</p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AppStatCard icon={<ShieldQuestion className="h-4 w-4" />} label="X-Real-IP presente" value={yesNoLabel(view.realIpPresent)} helper={<AppStatusBadge label={yesNoLabel(view.realIpPresent)} tone={yesNoTone(view.realIpPresent)} />} />
        <AppStatCard icon={<ShieldCheck className="h-4 w-4" />} label="X-Real-IP válido" value={yesNoLabel(view.realIpValid)} helper={<AppStatusBadge label={yesNoLabel(view.realIpValid)} tone={yesNoTone(view.realIpValid)} />} />
        <AppStatCard icon={<Network className="h-4 w-4" />} label="Saltos no X-Forwarded-For" value={String(view.hops)} helper={`Linhas de header: ${view.headerLines}. Conexão com o BFF: ${view.peer}.`} />
        <AppStatCard label="X-Real-IP = primeiro X-Forwarded-For" value={yesNoLabel(view.matchesFirstHop)} helper={<AppStatusBadge label={yesNoLabel(view.matchesFirstHop)} tone={yesNoTone(view.matchesFirstHop)} />} />
        <AppStatCard label="X-Real-IP = último X-Forwarded-For" value={yesNoLabel(view.matchesLastHop)} helper="Diferença aqui é comum quando há uma camada pública (CDN/borda) no caminho." />
      </div>

      <AppSectionBlock title="Alertas de topologia" subtitle="Derivados apenas desta requisição.">
        {view.alerts.length ? (
          <ul className="space-y-2" aria-label="Alertas de topologia">
            {view.alerts.map((alert, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                <AppStatusBadge label={alert.tone === "info" ? "Info" : "Atenção"} tone={alert.tone} />
                <span>{alert.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">Nenhum alerta para esta requisição.</p>
        )}
      </AppSectionBlock>

      <AppSectionBlock title="Cadeia observada" subtitle="Da esquerda (informada antes) para a direita (adicionada pelo proxy mais próximo). Endereços internos nunca são exibidos.">
        {view.chain.length ? (
          <ol className="space-y-1 text-sm" aria-label="Cadeia X-Forwarded-For">
            {view.chain.map((hop) => (
              <li key={hop.position} className="flex flex-wrap gap-2">
                <span className="font-medium text-[var(--text-primary)]">#{hop.position + 1}</span>
                <span className="font-mono text-[var(--text-primary)]">{hop.label}</span>
                <span className="text-[var(--text-secondary)]">{hop.detail}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">Sem X-Forwarded-For nesta requisição.</p>
        )}
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          X-Real-IP: <span className="font-mono text-[var(--text-primary)]">{view.realIpLabel}</span>
        </p>
      </AppSectionBlock>

      <AppSectionBlock title="Formatos agregados recentes" subtitle="Contagens da janela atual de observação, sem endereços.">
        {view.aggregate.buckets.length ? (
          <ul className="space-y-1 text-sm" aria-label="Formatos agregados">
            {view.aggregate.buckets.map((bucket) => (
              <li key={bucket.shape} className="flex flex-wrap gap-2">
                <span className="font-mono text-[var(--text-primary)]">{bucket.shape}</span>
                <span className="text-[var(--text-secondary)]">{bucket.count} requisição(ões)</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">Ainda não há contagens nesta janela.</p>
        )}
      </AppSectionBlock>
    </div>
  );
}

export default function IpDiagnosticPage() {
  const [revealAddresses, setRevealAddresses] = useState(false);
  const query = trpc.system.clientIpDiagnostic.useQuery(
    { addresses: revealAddresses ? "full" : "masked" },
    {
      retry: false,
      refetchOnWindowFocus: false,
      // Always send the request, even if the browser reported "offline" (iOS can do that during a
      // network handover). A real network failure then surfaces as a visible error instead of a
      // silently paused query.
      networkMode: "always",
      // Kept only in memory, and full addresses are dropped as soon as they are no longer shown.
      gcTime: revealAddresses ? 0 : undefined,
    }
  );
  const statusRef = useRef<HTMLDivElement>(null);
  // Keep the status line on screen for a check the user asked for (short phones), at the start
  // ("Verificando...") and when it completes. "nearest" does not move the page if it is visible.
  const showStatus = () => requestAnimationFrame(() => statusRef.current?.scrollIntoView({ block: "nearest" }));
  const recheck = () => {
    showStatus();
    void query.refetch().finally(showStatus);
  };
  const state = resolveDiagnosticQueryState({
    status: query.status,
    fetchStatus: query.fetchStatus,
    dataUpdatedAt: query.dataUpdatedAt,
    errorUpdatedAt: query.errorUpdatedAt,
    error: query.error,
  });

  return (
    <AppPageShell className="space-y-4">
      <AppOperationalHeader
        title="Diagnóstico da cadeia de IP"
        description="Mostra como a sua própria requisição chegou ao BFF, para validar a topologia de proxies sem abrir JSON nem compartilhar endereços."
        primaryAction={
          <Button type="button" onClick={recheck} disabled={state.checking} aria-busy={state.checking}>
            <RefreshCw aria-hidden="true" className={cn("mr-2 h-4 w-4", state.checking && "motion-safe:animate-spin")} />
            {state.checking ? DIAGNOSTIC_STATUS_TEXT.checking : "Verificar novamente"}
          </Button>
        }
        secondaryActions={
          <Button type="button" variant="ghost" onClick={() => setRevealAddresses((value) => !value)} aria-pressed={revealAddresses}>
            {revealAddresses ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {revealAddresses ? "Ocultar endereços" : "Mostrar endereços completos"}
          </Button>
        }
        contextChips={
          <>
            <AppStatusBadge label="Somente plataforma" tone="info" />
            <AppStatusBadge label="NO_TRUST ativo" tone="neutral" />
          </>
        }
      />

      {/* State first: on phones the header already fills most of the screen. */}
      <IpDiagnosticStatus ref={statusRef} state={state} />
      <IpDiagnosticStateView state={state} error={query.error} data={query.data} onRetry={recheck} />

      <IpDiagnosticDisclaimer />
      {revealAddresses ? (
        <AppSectionCard role="note" aria-label="Aviso de privacidade">
          <p className="text-sm text-[var(--text-secondary)]">
            Endereços completos aparecem apenas nesta tela, ficam só na memória do navegador e não são registrados. Não compartilhe capturas de tela com endereços.
          </p>
        </AppSectionCard>
      ) : null}

    </AppPageShell>
  );
}
