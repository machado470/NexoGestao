import { transientReadOptions } from "@/lib/read-query-retry";
import { organizationDayRange } from "@/lib/local-date-time";
import { MobileModuleHeader } from "@/components/MobileModuleHeader";
import { ResponsiveDetails } from "@/components/ResponsiveDetails";
import { useOrganizationLocale } from "@/contexts/OrganizationLocaleContext";
import { formatOrganizationDate } from "@/lib/organization-locale";
import { buildAuditActorOptions } from "@/lib/audit-actor-options";
import { presentationLabel } from "@/lib/presentation-labels";
import { useMemo, useState } from "react";
import { Eye, RefreshCw, Search, X } from "lucide-react";

import { BaseModal } from "@/components/app-modal-system";
import {
  AppAlert,
  AppAlertDescription,
  AppAlertTitle,
  AppEmptyState,
  AppField,
  AppFormActions,
  AppInput,
  AppLoadingState,
  AppPageShell,
} from "@/components/app-system";
import {
  AppContextChip,
  AppDataTable,
  AppFiltersBar,
  AppOperationalHeader,
  AppPagination,
  AppSectionBlock,
} from "@/components/internal-page-system";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";

export const AUDIT_PAGE_SIZE = 25;

export type AuditEvent = {
  id: string;
  createdAt: string;
  actorName?: string | null;
  actorPersonId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  orgId: string;
  context?: string | null;
  metadata?: unknown;
};

type AuditPagination = { page: number; limit: number; total: number; pages: number };
type AuditSummary = {
  total: number;
  byAction: Array<{ action: string; count: number }>;
  byActor: Array<{ actorPersonId?: string | null; actorName?: string | null; count: number }>;
};
type AuditFilters = { from?: string; to?: string; actorPersonId?: string; action?: string };

const EMPTY_PAGINATION: AuditPagination = { page: 1, limit: AUDIT_PAGE_SIZE, total: 0, pages: 0 };
const EMPTY_SUMMARY: AuditSummary = { total: 0, byAction: [], byActor: [] };
const SENSITIVE_KEY = /(token|secret|password|credential|authorization|cookie|api.?key)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapEnvelope(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;
  if (isRecord(payload.data) && (Array.isArray(payload.data.data) || isRecord(payload.data.pagination))) return payload.data;
  return payload;
}

export function normalizeAuditList(payload: unknown): { events: AuditEvent[]; pagination: AuditPagination } {
  const envelope = unwrapEnvelope(payload);
  if (!isRecord(envelope)) return { events: [], pagination: EMPTY_PAGINATION };
  const pagination = isRecord(envelope.pagination) ? envelope.pagination : {};
  return {
    events: Array.isArray(envelope.data) ? envelope.data as AuditEvent[] : [],
    pagination: {
      page: Number(pagination.page) || 1,
      limit: Number(pagination.limit) || AUDIT_PAGE_SIZE,
      total: Number(pagination.total) || 0,
      pages: Number(pagination.pages) || 0,
    },
  };
}

export function normalizeAuditSummary(payload: unknown): AuditSummary {
  const envelope = isRecord(payload) && isRecord(payload.data) && "total" in payload.data ? payload.data : payload;
  if (!isRecord(envelope)) return EMPTY_SUMMARY;
  return {
    total: Number(envelope.total) || 0,
    byAction: Array.isArray(envelope.byAction) ? envelope.byAction as AuditSummary["byAction"] : [],
    byActor: Array.isArray(envelope.byActor) ? envelope.byActor as AuditSummary["byActor"] : [],
  };
}

export function getAuditEventMetadata(event: AuditEvent | null): unknown {
  return event?.metadata ?? null;
}

export function getSafeMetadataEntries(metadata: unknown): Array<[string, string]> {
  if (!isRecord(metadata)) return [];
  return Object.entries(metadata)
    .filter(([key, value]) => !SENSITIVE_KEY.test(key) && ["string", "number", "boolean"].includes(typeof value))
    .map(([key, value]) => [key, String(value)]);
}

export function getAuditEmptyState(events: AuditEvent[], isLoading: boolean): boolean {
  return !isLoading && events.length === 0;
}

export function getNextAuditPage(currentPage: number, totalPages: number): number {
  return Math.min(currentPage + 1, Math.max(totalPages, 1));
}

function fieldLabel(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}

export default function AuditPage() {
  const { timezone, ready: localeReady } = useOrganizationLocale();
  const formatDateTime = (value: string) => formatOrganizationDate(value,timezone,"—",{dateStyle:"short",timeStyle:"medium"});
  const [filterError, setFilterError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [draftFilters, setDraftFilters] = useState({ from: "", to: "", actorPersonId: "", action: "" });
  const [filters, setFilters] = useState<AuditFilters>({});
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const { isAuthenticated, role } = useAuth();
  const canLoadAudit = isAuthenticated && role === "ADMIN";
  const listQuery = trpc.audit.listEvents.useQuery(
    { page, limit: AUDIT_PAGE_SIZE, ...filters },
    { enabled: canLoadAudit, ...transientReadOptions },
  );
  const summaryQuery = trpc.audit.getSummary.useQuery(
    { from: filters.from, to: filters.to },
    { enabled: canLoadAudit, ...transientReadOptions },
  );
  const actorsQuery = trpc.people.list.useQuery(undefined, { enabled: canLoadAudit, ...transientReadOptions });
  const listLoading = listQuery.isLoading || (listQuery.isFetching && listQuery.isError);
  const listFailed = listQuery.isError && !listQuery.isFetching;
  const summaryFailed = summaryQuery.isError && !summaryQuery.isFetching;
  const actors = Array.isArray(actorsQuery.data) ? actorsQuery.data : [];
  const { events, pagination } = useMemo(() => normalizeAuditList(listQuery.data), [listQuery.data]);
  const summary = useMemo(() => normalizeAuditSummary(summaryQuery.data), [summaryQuery.data]);
  const actorOptions = buildAuditActorOptions(actors, summary.byActor, events, draftFilters.actorPersonId);
  const metadataEntries = getSafeMetadataEntries(getAuditEventMetadata(selectedEvent));
  const hasFilters = Object.values(filters).some(Boolean);

  function applyFilters() {
    if ((draftFilters.from || draftFilters.to) && !localeReady) { setFilterError("Aguarde a confirmação do fuso da empresa para filtrar por data."); return; }
    const start = draftFilters.from ? organizationDayRange(draftFilters.from,timezone) : null;
    const end = draftFilters.to ? organizationDayRange(draftFilters.to,timezone) : null;
    if ((draftFilters.from && !start) || (draftFilters.to && !end) || (start && end && start.from > end.to)) { setFilterError("Informe um período válido, com início anterior ou igual ao fim."); return; }
    setFilterError(null);
    setPage(1);
    setFilters({
      from: start?.from,
      to: end?.to,
      actorPersonId: draftFilters.actorPersonId.trim() || undefined,
      action: draftFilters.action.trim() || undefined,
    });
  }
  function clearFilters() {
    setFilterError(null);
    setDraftFilters({ from: "", to: "", actorPersonId: "", action: "" });
    setFilters({});
    setPage(1);
  }
  function retry() { void listQuery.refetch(); void summaryQuery.refetch(); }

  return (
    <AppPageShell className="operational-mobile-page mobile-module-page evidence-mobile-page gap-4" data-testid="audit-admin-page">
      <MobileModuleHeader title="Auditoria" description="Registros administrativos e suas evidências." context={listQuery.isSuccess ? `${events.length} ${events.length === 1 ? "registro" : "registros"} nesta página${hasFilters ? " · Filtros aplicados" : ""}` : undefined} onRefresh={retry} />
      <div className="hidden md:block">
      <AppOperationalHeader
        title="Auditoria"
        description="Rastreabilidade administrativa dos fatos e evidências registrados. Esta fonte é independente da Timeline operacional."
        contextChips={<>
          <AppContextChip>{events.length} registro(s) nesta página</AppContextChip>
          {!summaryQuery.isLoading && !summaryQuery.isError ? <AppContextChip>{summary.total} no recorte oficial</AppContextChip> : null}
          {hasFilters ? <AppContextChip tone="accent">Filtros aplicados</AppContextChip> : null}
        </>}
      />
      </div>

      <AppFiltersBar className="module-filters flex-col items-stretch gap-3 p-3 md:p-4">
        <ResponsiveDetails title="Filtrar registros" controls>
        <form onSubmit={event => { event.preventDefault(); applyFilters(); }}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AppField label="Período inicial" htmlFor="audit-from"><AppInput id="audit-from" type="date" value={draftFilters.from} onChange={event => setDraftFilters(current => ({ ...current, from: event.target.value }))} /></AppField>
            <AppField label="Período final" htmlFor="audit-to"><AppInput id="audit-to" type="date" value={draftFilters.to} onChange={event => setDraftFilters(current => ({ ...current, to: event.target.value }))} /></AppField>
            <AppField label="Ator" htmlFor="audit-actor"><select id="audit-actor" className="w-full min-w-0 rounded-md border border-[var(--field-border)] bg-[var(--field-bg)] p-2 text-base text-[var(--field-text)] md:text-sm" disabled={actorsQuery.isLoading && summaryQuery.isLoading && events.length === 0} value={draftFilters.actorPersonId} onChange={event => setDraftFilters(current => ({ ...current, actorPersonId: event.target.value }))}>
              <option value="">Todos os atores</option>
              {actorOptions.map(actor => <option key={actor.id} value={actor.id}>{actor.label}</option>)}
            </select>{actorsQuery.isError ? <p role="status">Cadastro de pessoas indisponível. Nomes do histórico continuam disponíveis quando retornados pela Auditoria.</p> : null}</AppField>
            <AppField label="Tipo de evento" htmlFor="audit-action"><select id="audit-action" className="w-full min-w-0 rounded-md border border-[var(--field-border)] bg-[var(--field-bg)] p-2 text-base text-[var(--field-text)] md:text-sm" value={draftFilters.action} onChange={event => setDraftFilters(current => ({ ...current, action: event.target.value }))}>
              <option value="">Todos os eventos</option>
              {Array.from(new Set([...summary.byAction.map(item => item.action), ...events.map(item => item.action), ...(draftFilters.action ? [draftFilters.action] : [])])).map(action => <option key={action} value={action}>{presentationLabel(action)}</option>)}
            </select></AppField>
          </div>
          {filterError ? <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{filterError}</p> : null}
          <AppFormActions className="mt-3 justify-start">
            <Button type="submit"><Search />Aplicar filtros</Button>
            <Button type="button" variant="neutral" onClick={clearFilters}><X />Limpar</Button>
          </AppFormActions>
        </form>
        </ResponsiveDetails>
      </AppFiltersBar>

      {listFailed || summaryFailed ? (
        <AppAlert variant="destructive">
          <AppAlertTitle>Não foi possível carregar toda a auditoria.</AppAlertTitle>
          <AppAlertDescription className="flex flex-wrap items-center justify-between gap-3">
            A listagem e o resumo mantêm estados independentes. Tente novamente sem perder os filtros.
            <Button type="button" variant="neutral" size="sm" className="min-h-11" onClick={retry}><RefreshCw />Tentar novamente</Button>
          </AppAlertDescription>
        </AppAlert>
      ) : null}

      <AppSectionBlock className="mobile-flat-section" title="Registros de auditoria" subtitle="Ordem oficial da API: eventos mais recentes primeiro. Selecione um registro para examinar sua evidência.">
        {listLoading ? <AppLoadingState label="Carregando registros de auditoria..." /> : listFailed ? <p role="status">Registros indisponíveis. Tente novamente acima.</p> : getAuditEmptyState(events, listLoading) ? (
          <AppEmptyState title={hasFilters ? "Nenhum registro corresponde aos filtros" : "Nenhum registro de auditoria"} description={hasFilters ? "Revise ou limpe os filtros para ampliar o recorte." : "Ainda não há fatos registrados para esta organização."} action={hasFilters ? <Button type="button" variant="neutral" onClick={clearFilters}>Limpar filtros</Button> : undefined} />
        ) : (
          <>
            <ol className="grid gap-3 md:hidden" aria-label="Registros de auditoria no celular">
              {events.map(event => <li key={event.id} className="module-list-item space-y-3">
                <time dateTime={event.createdAt} className="block text-xs text-[var(--text-muted)]">{formatDateTime(event.createdAt)}</time>
                <h2 className="break-words font-semibold">{presentationLabel(event.action)}</h2>
                <p className="break-words text-sm text-[var(--text-secondary)]">{event.actorName || event.actorPersonId || event.actorUserId || "Sistema"}</p>
                <p className="text-xs text-[var(--text-muted)]">{presentationLabel(event.entityType)}</p>
                {event.context ? <p className="break-words text-sm text-[var(--text-secondary)]">{event.context}</p> : null}
                <Button type="button" className="min-h-11 w-full" onClick={() => setSelectedEvent(event)} aria-label={`Examinar evento ${presentationLabel(event.action)}`}><Eye />Examinar registro</Button>
              </li>)}
            </ol>
            <div className="hidden md:block">
            <AppDataTable label="Registros de auditoria" className="min-w-[860px]">
              <thead><tr><th scope="col">Data e hora</th><th scope="col">Evento</th><th scope="col">Ator</th><th scope="col">Entidade</th><th scope="col">Identificador</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>{events.map(event => (
                <tr key={event.id}>
                  <td className="whitespace-nowrap">{formatDateTime(event.createdAt)}</td>
                  <td><span className="font-medium text-[var(--text-primary)]">{presentationLabel(event.action)}</span>{event.context ? <span className="mt-1 block max-w-sm text-xs text-[var(--text-muted)]">{event.context}</span> : null}</td>
                  <td>{event.actorName || event.actorPersonId || event.actorUserId || "Sistema"}</td>
                  <td>{presentationLabel(event.entityType)}</td>
                  <td className="max-w-56 break-all">{event.entityId || "—"}</td>
                  <td><Button type="button" variant="ghost" size="sm" onClick={() => setSelectedEvent(event)} aria-label={`Examinar evento ${presentationLabel(event.action)}`}><Eye />Examinar</Button></td>
                </tr>
              ))}</tbody>
            </AppDataTable>
            </div>
            <AppPagination currentPage={pagination.page} totalItems={pagination.total} pageSize={pagination.limit} onPageChange={setPage} />
          </>
        )}
      </AppSectionBlock>

      <BaseModal open={Boolean(selectedEvent)} onOpenChange={open => { if (!open) setSelectedEvent(null); }} size="lg" title="Evidência do registro" description="Dados oficiais disponíveis no registro selecionado." footer={<Button type="button" variant="neutral" onClick={() => setSelectedEvent(null)}>Fechar</Button>}>
        {selectedEvent ? <div className="space-y-5 text-sm">
          <dl className="grid gap-4 sm:grid-cols-2">
            {[["Evento", presentationLabel(selectedEvent.action)], ["Data e hora", formatDateTime(selectedEvent.createdAt)], ["Ator", selectedEvent.actorName || selectedEvent.actorPersonId || selectedEvent.actorUserId || "Sistema"], ["Entidade", presentationLabel(selectedEvent.entityType)], ["ID da entidade", selectedEvent.entityId || "—"], ["ID do registro", selectedEvent.id], ["Organização", selectedEvent.orgId], ["Contexto", selectedEvent.context || "—"]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs font-medium text-[var(--text-muted)]">{label}</dt><dd className="mt-1 break-words text-[var(--text-primary)]">{value}</dd></div>)}
          </dl>
          <section aria-labelledby="audit-evidence-title"><h2 id="audit-evidence-title" className="font-semibold text-[var(--text-primary)]">Detalhes da evidência</h2>{metadataEntries.length ? <dl className="mt-3 grid gap-3 sm:grid-cols-2">{metadataEntries.map(([key, value]) => <div key={key} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3"><dt className="text-xs capitalize text-[var(--text-muted)]">{fieldLabel(key)}</dt><dd className="mt-1 break-all text-[var(--text-primary)]">{value}</dd></div>)}</dl> : <p className="mt-2 text-[var(--text-muted)]">Nenhum detalhe adicional disponível neste registro.</p>}</section>
        </div> : null}
      </BaseModal>
    </AppPageShell>
  );
}
