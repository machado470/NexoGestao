import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { Button } from "@/components/design-system";
import {
  AppFiltersBar,
  AppKpiRow,
  AppListBlock,
  AppLoadingState,
  AppSecondaryTabs,
  AppStatusBadge,
  AppNextActionCard,
  AppSectionBlock,
  Input,
} from "@/components/internal-page-system";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { formatDelta, getDayWindow, percentDelta, safeDate, trendFromDelta } from "@/lib/operational/kpi";
import { KpiErrorBoundary } from "@/components/KpiErrorBoundary";
import { TrpcSectionErrorBoundary } from "@/components/TrpcSectionErrorBoundary";
import { setBootPhase } from "@/lib/bootPhase";
import { AppSelect } from "@/components/app-system";

function toLabel(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

export default function TimelinePage() {
  setBootPhase("PAGE:Timeline");
  useRenderWatchdog("TimelinePage");
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"all" | "finance" | "service_order" | "appointment" | "whatsapp" | "governance">("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [events, setEvents] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 20;
  const timelineQuery = trpc.nexo.timeline.listByOrg.useQuery({ limit: pageSize, cursor }, { retry: false });

  useEffect(() => {
    if (!timelineQuery.data) return;
    const incoming = normalizeArrayPayload<any>(timelineQuery.data);
    setHasMore(incoming.length === pageSize);
    setEvents((prev) => {
      if (!cursor) return incoming;
      const seen = new Set(prev.map((item) => String(item?.id ?? "")));
      const merged = [...prev];
      incoming.forEach((item) => {
        const key = String(item?.id ?? "");
        if (!seen.has(key)) merged.push(item);
      });
      return merged;
    });
  }, [cursor, timelineQuery.data]);
  usePageDiagnostics({
    page: "timeline",
    isLoading: timelineQuery.isLoading,
    hasError: Boolean(timelineQuery.error),
    isEmpty: !timelineQuery.isLoading && !timelineQuery.error && events.length === 0,
    dataCount: events.length,
  });

  const filteredEvents = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return events.filter((event) => {
      const date = safeDate(event?.createdAt);
      if (typeFilter !== "all" && String(event?.type ?? event?.action ?? "").toLowerCase() !== typeFilter) return false;
      if (activeTab !== "all") {
        const bucket = `${String(event?.type ?? "").toLowerCase()} ${String(event?.entityType ?? "").toLowerCase()} ${String(event?.action ?? "").toLowerCase()}`;
        if (activeTab === "governance" && !bucket.includes("govern")) return false;
        if (activeTab !== "governance" && !bucket.includes(activeTab.replace("_", "")) && !bucket.includes(activeTab)) return false;
      }
      if (entityFilter !== "all" && String(event?.entityType ?? "").toLowerCase() !== entityFilter) return false;
      
      if (periodFilter === "24h" && (!date || Date.now() - date.getTime() > 1000 * 60 * 60 * 24)) return false;
      if (periodFilter === "7d" && (!date || Date.now() - date.getTime() > 1000 * 60 * 60 * 24 * 7)) return false;
      if (periodFilter === "30d" && (!date || Date.now() - date.getTime() > 1000 * 60 * 60 * 24 * 30)) return false;
      if (!q) return true;
      const text = [
        event?.action,
        event?.type,
        event?.entityType,
        event?.entityId,
        event?.actorName,
        event?.title,
        event?.description,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");
      return text.includes(q);
    });
  }, [activeTab, entityFilter, events, filter, periodFilter, typeFilter]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, any[]>();
    filteredEvents.forEach((event) => {
      const key = event?.createdAt ? new Date(String(event.createdAt)).toLocaleDateString("pt-BR") : "Sem data";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(event);
    });
    return Array.from(groups.entries());
  }, [filteredEvents]);

  const criticalEvents = filteredEvents.filter((event) =>
    ["critical", "error", "failed"].includes(String(event?.severity ?? event?.status ?? "").toLowerCase())
  ).length;
  const failedRecent = filteredEvents.filter((event) =>
    String(event?.status ?? event?.executionMode ?? "").toLowerCase().includes("fail")
  ).length;
  const semRetorno = filteredEvents.filter((event) =>
    String(event?.description ?? event?.title ?? "").toLowerCase().includes("sem retorno")
  ).length;
  const uniqueEntities = new Set(filteredEvents.map((event) => String(event?.entityId ?? "")).filter(Boolean)).size;
  const eventosAcionaveis = filteredEvents.slice(0, 8).map((event) => {
    const entity = String(event?.entityType ?? "").toLowerCase();
    const route = entity.includes("service") ? "/service-orders" : entity.includes("appoint") ? "/appointments" : entity.includes("charge") ? "/finances" : "/dashboard";
    return {
      title: toLabel(event?.title ?? event?.action ?? event?.type, "Evento operacional"),
      subtitle: `${toLabel(event?.entityType, "Entidade")} #${toLabel(event?.entityId, "—")} · ${event?.createdAt ? new Date(String(event.createdAt)).toLocaleString("pt-BR") : "sem data"}`,
      action: <Button type="button" variant="outline" onClick={() => navigate(route)}>Agir</Button>,
    };
  });
  const currentDay = getDayWindow(0);
  const previousDay = getDayWindow(1);
  const recentEvents = events.filter((event) => {
    const date = safeDate(event?.createdAt);
    return Boolean(date && date >= currentDay.start && date < currentDay.end);
  }).length;
  const recentPrevious = events.filter((event) => {
    const date = safeDate(event?.createdAt);
    return Boolean(date && date >= previousDay.start && date < previousDay.end);
  }).length;
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[RENDER PAGE] timeline");
  }, []);
  useEffect(() => {
    if (!timelineQuery.error) return;
    // eslint-disable-next-line no-console
    console.error("[TRPC ERROR] timeline_query_error", timelineQuery.error.message);
  }, [timelineQuery.error]);
  return (
    <PageWrapper title="Timeline operacional" subtitle="Histórico auditável em lotes, com leitura objetiva para decisão.">
      <OperationalTopCard
        contextLabel="Direção de auditoria"
        title="Histórico operacional rastreável"
        description="Acompanhe o que aconteceu, o que falhou e o que precisa de reação sem feed infinito."
        primaryAction={(
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => void timelineQuery.refetch()}>
              Atualizar timeline
            </Button>
            <Button type="button" onClick={() => {
              const last = events[events.length - 1];
              if (!last?.id || !last?.createdAt) return;
              setCursor(`${String(last.createdAt)}_${String(last.id)}`);
            }} disabled={!hasMore || timelineQuery.isFetching}>
              {timelineQuery.isFetching ? "Carregando..." : "Carregar mais"}
            </Button>
          </div>
        )}
      />

      <KpiErrorBoundary context="timeline:kpi">
        <AppKpiRow
        items={[
          {
            title: "Eventos recentes",
            value: String(recentEvents),
            delta: formatDelta(percentDelta(recentEvents, recentPrevious)),
            trend: trendFromDelta(percentDelta(recentEvents, recentPrevious)),
            hint: "hoje vs ontem",
          },
          { title: "Eventos críticos", value: String(criticalEvents), hint: "pedem intervenção" },
          { title: "Entidades impactadas", value: String(uniqueEntities), hint: "na janela filtrada" },
        ]}
      />
      </KpiErrorBoundary>
      <AppSecondaryTabs
        items={[
          { value: "all", label: "Todos" },
          { value: "finance", label: "Financeiro" },
          { value: "service_order", label: "O.S." },
          { value: "appointment", label: "Agendamento" },
          { value: "whatsapp", label: "Comunicação" },
          { value: "governance", label: "Governança" },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      <div className="grid gap-3 xl:grid-cols-12">
      <AppSectionBlock
        title="O que deu problema"
        subtitle="Bloco principal: eventos críticos que exigem reação imediata antes de qualquer outra leitura"
        className="border-rose-500/20 bg-rose-500/5 xl:col-span-8"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--text-secondary)]">{criticalEvents} eventos críticos e {failedRecent} falhas recentes pedindo reação imediata.</p>
          <Button type="button" onClick={() => window.scrollTo({ top: 720, behavior: "smooth" })}>Resolver agora</Button>
        </div>
        <AppListBlock
          className="col-span-full"
          items={eventosAcionaveis.slice(0, 5).length > 0
            ? eventosAcionaveis.slice(0, 5)
            : [
              {
                title: "Sem eventos críticos no momento",
                subtitle: "Use os módulos operacionais para gerar novos registros auditáveis.",
                action: <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>Ir para dashboard</Button>,
              },
            ]}
        />
      </AppSectionBlock>

      <div className="space-y-3 xl:col-span-4">
        <AppNextActionCard
          title="O que precisa de atenção"
          description={`${uniqueEntities} entidades com sinal de atraso e ${semRetorno} eventos marcados como sem retorno.`}
          severity={criticalEvents > 0 || semRetorno > 0 ? "high" : "medium"}
          metadata="atenção de execução"
          action={{ label: "Analisar agora", onClick: () => window.scrollTo({ top: 720, behavior: "smooth" }) }}
        />
        <AppSectionBlock title="Lotes acionáveis" subtitle="Controle de carga com execução direta por lote." className="bg-[var(--surface-base)]/70">
          <AppListBlock
            items={[
              { title: `${events.length} eventos carregados`, subtitle: `Lotes de ${pageSize} com controle manual` },
              { title: `${criticalEvents} críticos na janela atual`, subtitle: "Priorize antes de puxar novos eventos" },
              { title: `${hasMore ? "Ainda há lotes pendentes" : "Sem novos lotes agora"}`, subtitle: hasMore ? "Clique em carregar mais quando finalizar este lote" : "Use atualizar timeline para buscar novos eventos" },
            ]}
          />
        </AppSectionBlock>
      </div>
      </div>

      <TrpcSectionErrorBoundary context="timeline:events-feed">
      <AppSectionBlock title="Feed de eventos" subtitle="Sem placeholders: somente eventos reais.">
        <AppFiltersBar>
          <Input
            placeholder="Filtrar por entidade, ação, tipo ou usuário"
            className="max-w-md"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <AppSelect
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={[
              { value: "all", label: "Todos os tipos" },
              { value: "finance", label: "Financeiro" },
              { value: "service_order", label: "O.S." },
              { value: "whatsapp", label: "WhatsApp" },
              { value: "appointment", label: "Agendamento" },
            ]}
          />
          <AppSelect
            value={entityFilter}
            onValueChange={setEntityFilter}
            options={[
              { value: "all", label: "Todas as entidades" },
              { value: "customer", label: "Cliente" },
              { value: "service_order", label: "O.S." },
              { value: "appointment", label: "Agendamento" },
              { value: "charge", label: "Cobrança" },
              { value: "whatsapp", label: "WhatsApp" },
            ]}
          />
          <AppSelect
            value={periodFilter}
            onValueChange={setPeriodFilter}
            options={[
              { value: "all", label: "Período total" },
              { value: "24h", label: "Últimas 24h" },
              { value: "7d", label: "Últimos 7 dias" },
              { value: "30d", label: "Últimos 30 dias" },
            ]}
          />
          <p className="text-xs text-[var(--text-muted)]">Mostrando {events.length} eventos carregados em lotes de {pageSize}.</p>
        </AppFiltersBar>

        {timelineQuery.isLoading ? (
          <AppLoadingState rows={5} />
        ) : filteredEvents.length === 0 ? (
          <AppListBlock
            items={[
              { title: "Sem eventos no filtro atual", subtitle: "Ajuste o período/tipo para localizar itens acionáveis.", action: <Button type="button" variant="outline" onClick={() => setPeriodFilter("all")}>Limpar período</Button> },
              { title: "Validar gargalos da agenda", subtitle: "Cheque atrasos e conflitos para alimentar a timeline.", action: <Button type="button" variant="outline" onClick={() => navigate("/appointments")}>Abrir agenda</Button> },
              { title: "Verificar cobranças vencidas", subtitle: "Ações financeiras criam novos eventos de execução.", action: <Button type="button" variant="outline" onClick={() => navigate("/finances")}>Abrir financeiro</Button> },
            ]}
          />
        ) : (
          <div className="space-y-3">
            <AppSectionBlock title="Eventos acionáveis" subtitle="Sem espaço vazio: tudo aqui tem próximo passo operacional.">
              <AppListBlock
                className="col-span-full"
                items={eventosAcionaveis.length > 0
                  ? eventosAcionaveis
                  : [
                    {
                      title: "Sem eventos acionáveis nesta janela",
                      subtitle: "Acione agenda, financeiro ou O.S. para produzir novos eventos operacionais.",
                      action: <Button type="button" variant="outline" onClick={() => navigate("/appointments")}>Abrir agenda</Button>,
                    },
                  ]}
              />
            </AppSectionBlock>
            {groupedEvents.map(([dateLabel, items]) => (
              <div key={dateLabel} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{dateLabel}</p>
                <ul className="space-y-2">
                  {items.map((event) => (
                    <li key={String(event?.id ?? `${event?.entityId}-${event?.createdAt}`)} className="rounded-lg border border-[var(--border-subtle)] p-3">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {toLabel(event?.title ?? event?.action ?? event?.type, "Evento operacional")}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {toLabel(event?.entityType, "Entidade")} #{toLabel(event?.entityId, "—")} · {toLabel(event?.actorName, "Sistema")} · {event?.createdAt ? new Date(String(event.createdAt)).toLocaleString("pt-BR") : "sem data"}
                      </p>
                      <div className="mt-2">
                        <AppStatusBadge label={String(event?.status ?? event?.executionMode ?? "manual").toLowerCase().includes("fail")
                          ? "Falha"
                          : String(event?.status ?? event?.executionMode ?? "").toLowerCase().includes("block")
                            ? "Bloqueado"
                            : String(event?.status ?? event?.executionMode ?? "").toLowerCase().includes("ignore")
                              ? "Ignorado"
                              : String(event?.executionMode ?? event?.source ?? "").toLowerCase().includes("auto")
                                ? "Automático"
                                : "Manual"} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="pt-1">
              <Button type="button" variant="outline" onClick={() => {
                const last = events[events.length - 1];
                if (!last?.id || !last?.createdAt) return;
                setCursor(`${String(last.createdAt)}_${String(last.id)}`);
              }} disabled={!hasMore || timelineQuery.isFetching}>
                {timelineQuery.isFetching ? "Carregando..." : hasMore ? "Carregar mais eventos" : "Sem mais eventos"}
              </Button>
            </div>
          </div>
        )}
      </AppSectionBlock>
      </TrpcSectionErrorBoundary>
    </PageWrapper>
  );
}
