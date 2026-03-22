import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  RefreshCw,
  Wrench,
  FileText,
  ListChecks,
  Paperclip,
  History,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Check,
  Link2,
} from "lucide-react";
import type {
  ExecutionAttachment,
  ExecutionChecklistItem,
  ExecutionRecord,
  ServiceOrder,
  TimelineEvent,
  TimelineEventMetadata,
} from "./service-order.types";
import { formatCurrency, formatDate, formatDateTime } from "./service-order.utils";

function getEventKey(event: TimelineEvent) {
  return String(event.action ?? event.type ?? "EVENT").toUpperCase();
}

function getEventLabel(event: TimelineEvent) {
  const key = getEventKey(event);

  const labels: Record<string, string> = {
    SERVICE_ORDER_CREATED: "O.S. criada",
    SERVICE_ORDER_UPDATED: "O.S. atualizada",
    SERVICE_ORDER_ASSIGNED: "O.S. atribuída",
    SERVICE_ORDER_STARTED: "Execução iniciada",
    SERVICE_ORDER_DONE: "Execução concluída",
    SERVICE_ORDER_CANCELED: "O.S. cancelada",
    EXECUTION_STARTED: "Execução fallback iniciada",
    EXECUTION_DONE: "Execução fallback concluída",
    CHARGE_CREATED: "Cobrança criada",
    CHARGE_UPDATED: "Cobrança atualizada",
    CHARGE_CANCELED: "Cobrança cancelada",
    CHARGE_DELETED: "Cobrança excluída",
    CHARGE_PAID: "Cobrança paga",
    CHARGE_OVERDUE: "Cobrança vencida",
  };

  return labels[key] ?? key.split("_").join(" ");
}

function getEventTone(action?: string | null) {
  const key = String(action ?? "").toUpperCase();

  if (key.includes("PAID") || key.includes("DONE") || key.includes("CREATED")) {
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  }

  if (
    key.includes("OVERDUE") ||
    key.includes("CANCELED") ||
    key.includes("CANCELLED")
  ) {
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  }

  if (
    key.includes("UPDATED") ||
    key.includes("ASSIGNED") ||
    key.includes("STARTED")
  ) {
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
  }

  return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
}

function getEventIcon(event: TimelineEvent) {
  const key = getEventKey(event);

  if (key.includes("CHARGE") || key.includes("PAYMENT")) {
    return Receipt;
  }

  if (key.includes("DONE") || key.includes("PAID")) {
    return CheckCircle2;
  }

  if (key.includes("OVERDUE") || key.includes("CANCELED")) {
    return AlertCircle;
  }

  if (key.includes("SERVICE_ORDER") || key.includes("EXECUTION")) {
    return Wrench;
  }

  return Clock3;
}

function getEventSummary(event: TimelineEvent) {
  const metadata = (event.metadata ?? {}) as TimelineEventMetadata;
  const serviceOrderId = metadata.serviceOrderId;
  const chargeId = metadata.chargeId;
  const executionId = metadata.executionId;
  const amountCents = metadata.amountCents;
  const status = metadata.status;
  const dueDate = metadata.dueDate;

  const pieces: string[] = [];

  if (serviceOrderId) {
    pieces.push(`O.S. #${String(serviceOrderId).slice(0, 8)}`);
  }

  if (executionId && executionId !== serviceOrderId) {
    pieces.push(`Exec. #${String(executionId).slice(0, 8)}`);
  }

  if (chargeId) {
    pieces.push(`Cobrança #${String(chargeId).slice(0, 8)}`);
  }

  if (typeof amountCents === "number" && Number.isFinite(amountCents)) {
    pieces.push(formatCurrency(amountCents));
  }

  if (typeof status === "string" && status.trim()) {
    pieces.push(`Status ${status}`);
  }

  if (typeof dueDate === "string" && dueDate.trim()) {
    pieces.push(`Venc. ${formatDate(dueDate)}`);
  }

  return pieces.join(" • ");
}

function formatChecklistItem(item: ExecutionChecklistItem) {
  if (typeof item === "string") {
    return {
      title: item,
      subtitle: "",
      checked: null as boolean | null,
    };
  }

  const title =
    item.label?.trim() ||
    item.value?.trim() ||
    item.note?.trim() ||
    "Item de checklist";

  const subtitle = [
    typeof item.value === "string" && item.value.trim() ? item.value.trim() : "",
    typeof item.note === "string" && item.note.trim() ? item.note.trim() : "",
  ]
    .filter(Boolean)
    .join(" • ");

  return {
    title,
    subtitle,
    checked: typeof item.checked === "boolean" ? item.checked : null,
  };
}

function formatAttachmentItem(item: ExecutionAttachment) {
  if (typeof item === "string") {
    return {
      title: item,
      subtitle: "",
      url: "",
    };
  }

  const title =
    item.name?.trim() ||
    item.type?.trim() ||
    item.url?.trim() ||
    item.id?.trim() ||
    "Anexo";

  const subtitle = [
    typeof item.type === "string" && item.type.trim() ? item.type.trim() : "",
    typeof item.size === "number" && Number.isFinite(item.size)
      ? `${item.size} bytes`
      : "",
  ]
    .filter(Boolean)
    .join(" • ");

  return {
    title,
    subtitle,
    url: typeof item.url === "string" ? item.url : "",
  };
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function sortByCreatedAtDesc<T extends { createdAt?: string | null }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}

function normalizeTimelinePayload(payload: unknown): TimelineEvent[] {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: TimelineEvent[] }).data;
  }

  if (Array.isArray(payload)) {
    return payload as TimelineEvent[];
  }

  return [];
}

function normalizeExecutionPayload(payload: unknown): ExecutionRecord[] {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: ExecutionRecord[] }).data;
  }

  if (Array.isArray(payload)) {
    return payload as ExecutionRecord[];
  }

  return [];
}

export default function ServiceOrderDetailsPanel({
  os,
}: {
  os: ServiceOrder;
}) {
  const timelineQuery = trpc.nexo.timeline.listByServiceOrder.useQuery(
    {
      serviceOrderId: os.id,
      limit: 20,
    },
    {
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const executionQuery = trpc.nexo.executions.listByServiceOrder.useQuery(
    {
      serviceOrderId: os.id,
    },
    {
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const timelineEvents = useMemo(() => {
    return sortByCreatedAtDesc(normalizeTimelinePayload(timelineQuery.data));
  }, [timelineQuery.data]);

  const executionRows = useMemo(() => {
    return sortByCreatedAtDesc(normalizeExecutionPayload(executionQuery.data));
  }, [executionQuery.data]);

  const latestExecution = executionRows[0] ?? null;
  const checklist = Array.isArray(latestExecution?.checklist)
    ? latestExecution.checklist
    : [];
  const attachments = Array.isArray(latestExecution?.attachments)
    ? latestExecution.attachments
    : [];

  const chargeStatusLabel = os.financialSummary?.chargeStatus ?? "Sem cobrança";
  const chargeAmountLabel = os.financialSummary?.hasCharge
    ? formatCurrency(os.financialSummary.chargeAmountCents ?? 0)
    : "—";
  const chargeDueDateLabel = os.financialSummary?.hasCharge
    ? formatDate(os.financialSummary.chargeDueDate)
    : "—";
  const paidAtLabel = os.financialSummary?.hasCharge
    ? formatDateTime(os.financialSummary.paidAt)
    : "—";

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-900/30">
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-orange-500" />
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Resumo da O.S.
          </h4>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <InfoItem label="Cliente" value={os.customer?.name || "—"} />
          <InfoItem
            label="Responsável"
            value={os.assignedTo?.name || "Não atribuído"}
          />
          <InfoItem label="Status" value={os.status} />
          <InfoItem label="Agendado" value={formatDateTime(os.scheduledFor)} />
          <InfoItem label="Início" value={formatDateTime(os.startedAt)} />
          <InfoItem label="Fim" value={formatDateTime(os.finishedAt)} />
        </div>

        {os.description?.trim() ? (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Descrição da O.S.
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {os.description}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-green-500" />
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Financeiro
          </h4>
        </div>

        {!os.financialSummary?.hasCharge ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Nenhuma cobrança vinculada a esta O.S.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoItem label="Status" value={chargeStatusLabel} />
            <InfoItem label="Valor" value={chargeAmountLabel} />
            <InfoItem label="Vencimento" value={chargeDueDateLabel} />
            <InfoItem label="Pago em" value={paidAtLabel} />
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-orange-500" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Execução vinculada
            </h4>
          </div>

          {executionQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Carregando execução...
            </div>
          ) : executionQuery.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              Não foi possível carregar a execução desta O.S.
            </div>
          ) : !latestExecution ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Nenhuma execução encontrada para esta O.S.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <InfoItem
                  label="Modo"
                  value={latestExecution.mode || "service-order-fallback"}
                />
                <InfoItem
                  label="Status"
                  value={String(latestExecution.status || "—")}
                />
                <InfoItem
                  label="Início real"
                  value={formatDateTime(latestExecution.startedAt)}
                />
                <InfoItem
                  label="Fim real"
                  value={formatDateTime(latestExecution.endedAt)}
                />
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Notas da execução
                  </p>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {latestExecution.notes?.trim()
                    ? latestExecution.notes
                    : "Sem notas registradas na execução."}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                  <div className="mb-2 flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-gray-500" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Checklist
                    </p>
                  </div>

                  {checklist.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Nenhum item registrado.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {checklist.map((item, index) => {
                        const parsed = formatChecklistItem(item);

                        return (
                          <div
                            key={`checklist-${index}`}
                            className="rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                          >
                            <div className="flex items-start gap-2">
                              {parsed.checked === true ? (
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                              ) : parsed.checked === false ? (
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                              ) : (
                                <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                              )}

                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {parsed.title}
                                </p>
                                {parsed.subtitle ? (
                                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {parsed.subtitle}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                  <div className="mb-2 flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-gray-500" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Anexos
                    </p>
                  </div>

                  {attachments.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Nenhum anexo registrado.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((item, index) => {
                        const parsed = formatAttachmentItem(item);

                        return (
                          <div
                            key={`attachment-${index}`}
                            className="rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                          >
                            <div className="flex items-start gap-2">
                              <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                              <div className="min-w-0">
                                <p className="break-all text-sm font-medium text-gray-900 dark:text-white">
                                  {parsed.title}
                                </p>
                                {parsed.subtitle ? (
                                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {parsed.subtitle}
                                  </p>
                                ) : null}
                                {parsed.url ? (
                                  <p className="mt-1 break-all text-xs text-blue-600 dark:text-blue-400">
                                    <Link2 className="mr-1 inline h-3.5 w-3.5" />
                                    {parsed.url}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-orange-500" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Timeline da O.S.
            </h4>
          </div>

          {timelineQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Carregando histórico...
            </div>
          ) : timelineQuery.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              Não foi possível carregar a timeline desta O.S.
            </div>
          ) : timelineEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Nenhum evento encontrado para esta O.S.
            </div>
          ) : (
            <div className="space-y-3">
              {timelineEvents.map((event) => {
                const EventIcon = getEventIcon(event);
                const summary = getEventSummary(event);

                return (
                  <div
                    key={event.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${getEventTone(
                              event.action
                            )}`}
                          >
                            <EventIcon className="h-3.5 w-3.5" />
                            {getEventLabel(event)}
                          </span>

                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDateTime(event.createdAt)}
                          </span>
                        </div>

                        {event.description ? (
                          <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                            {event.description}
                          </p>
                        ) : null}

                        {summary ? (
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {summary}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
