import { CheckCircle2, PlayCircle, XCircle } from "lucide-react";

import { AppSkeleton } from "@/components/app-system";
import { Button } from "@/components/design-system";
import { cn } from "@/lib/utils";

export type WhatsAppSuggestedAction =
  | "SEND_PAYMENT_LINK"
  | "CONFIRM_APPOINTMENT"
  | "RESCHEDULE_APPOINTMENT"
  | "SEND_SERVICE_UPDATE"
  | "ESCALATE_TO_OPERATOR"
  | "MARK_RESOLVED"
  | "REPLY_WITH_TEMPLATE";

export type WhatsAppActionExecutionStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "EXECUTED"
  | "FAILED"
  | "CANCELLED";

export type WhatsAppActionExecution = {
  id: string;
  conversationId: string;
  suggestedAction: WhatsAppSuggestedAction;
  status: WhatsAppActionExecutionStatus;
  approvalRequired?: boolean | null;
  executionReason?: string | null;
  failureReason?: string | null;
  actionPayload?: Record<string, unknown> | null;
  createdAt?: string | null;
  approvedAt?: string | null;
  executedAt?: string | null;
  failedAt?: string | null;
  cancelledAt?: string | null;
  conversation?: {
    id?: string;
    customerId?: string | null;
    phone?: string | null;
    title?: string | null;
    priority?: string | null;
    intent?: string | null;
  } | null;
};

export function whatsappActionLabel(action?: string | null) {
  const labels: Record<string, string> = {
    SEND_PAYMENT_LINK: "Enviar link de pagamento",
    CONFIRM_APPOINTMENT: "Confirmar agendamento",
    RESCHEDULE_APPOINTMENT: "Reagendar agendamento",
    SEND_SERVICE_UPDATE: "Atualizar O.S.",
    ESCALATE_TO_OPERATOR: "Escalar para operador",
    MARK_RESOLVED: "Marcar como resolvida",
    REPLY_WITH_TEMPLATE: "Responder com template",
  };
  return labels[String(action ?? "")] ?? String(action ?? "Ação");
}

export function whatsappExecutionStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    PENDING_APPROVAL: "Aguardando aprovação",
    APPROVED: "Aprovada",
    EXECUTED: "Executada",
    FAILED: "Falhou",
    CANCELLED: "Cancelada",
  };
  return labels[String(status ?? "")] ?? String(status ?? "--");
}

export function formatWhatsAppExecutionDate(value?: string | null) {
  if (!value) return "Sem data";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem data";
  return parsed.toLocaleString("pt-BR");
}

export function buildWhatsAppExecutionPath(execution: WhatsAppActionExecution) {
  const params = new URLSearchParams();
  const conversationId = execution.conversationId || execution.conversation?.id;
  if (conversationId) params.set("conversationId", conversationId);
  if (execution.conversation?.customerId)
    params.set("customerId", execution.conversation.customerId);
  const query = params.toString();
  return query ? `/whatsapp?${query}` : "/whatsapp";
}

function formatPayloadValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "sim" : "não";
  return String(value);
}

export function compactWhatsAppPayloadSummary(
  payload?: Record<string, unknown> | null
) {
  if (!payload || Object.keys(payload).length === 0)
    return "Payload contextual seguro";

  const preferred: Array<[string, string]> = [
    ["customerName", "Cliente"],
    ["paymentLink", "Link"],
    ["chargeAmount", "Valor"],
    ["chargeDueDate", "Venc."],
    ["appointmentDate", "Agenda"],
    ["serviceOrderNumber", "O.S."],
    ["templateKey", "Template"],
    ["entityType", "Entidade"],
    ["entityId", "ID"],
  ];

  const parts = preferred
    .map(([key, label]) => {
      const value = formatPayloadValue(payload[key]);
      return value ? `${label}: ${value}` : null;
    })
    .filter(Boolean) as string[];

  if (parts.length === 0) return "Payload contextual seguro";
  return parts.slice(0, 3).join(" · ");
}

export function WhatsAppExecutionStatusBadge({
  status,
}: {
  status?: string | null;
}) {
  const normalized = String(status ?? "");
  const className =
    normalized === "PENDING_APPROVAL"
      ? "bg-[color-mix(in_srgb,var(--warning)_14%,var(--app-surface))] text-[var(--warning)]"
      : normalized === "APPROVED"
        ? "bg-[color-mix(in_srgb,var(--info)_12%,var(--app-surface))] text-[var(--info)]"
        : normalized === "EXECUTED"
          ? "bg-[color-mix(in_srgb,var(--success)_12%,var(--app-surface))] text-[var(--success)]"
          : normalized === "FAILED"
            ? "bg-[color-mix(in_srgb,var(--danger)_12%,var(--app-surface))] text-[var(--danger)]"
            : normalized === "CANCELLED"
              ? "bg-app-surface text-app-muted"
              : "bg-app-surface text-[var(--text-secondary)]";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        className
      )}
    >
      {whatsappExecutionStatusLabel(status)}
    </span>
  );
}

export function WhatsAppPendingApprovalCard({
  execution,
  disabled,
  onApprove,
  onExecute,
  onCancel,
}: {
  execution: WhatsAppActionExecution;
  disabled?: boolean;
  onApprove: (execution: WhatsAppActionExecution) => void;
  onExecute: (execution: WhatsAppActionExecution) => void;
  onCancel: (execution: WhatsAppActionExecution) => void;
}) {
  const requiresApproval =
    execution.status === "PENDING_APPROVAL" ||
    execution.approvalRequired === true;
  return (
    <article className="rounded-2xl bg-[color-mix(in_srgb,var(--warning)_10%,var(--app-surface))] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
            {whatsappActionLabel(execution.suggestedAction)}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
            {execution.conversation?.title ??
              "Ação sensível aguardando decisão humana"}
          </p>
        </div>
        <WhatsAppExecutionStatusBadge status={execution.status} />
      </div>
      <p className="mt-2 line-clamp-2 text-[11px] text-[var(--text-secondary)]">
        {execution.executionReason ?? "Sem motivo informado."}
      </p>
      <p className="mt-2 rounded-lg bg-app-card px-2 py-1 text-[10px] text-app-muted">
        {compactWhatsAppPayloadSummary(execution.actionPayload)}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[10px]"
          disabled={disabled}
          onClick={() => onApprove(execution)}
        >
          <CheckCircle2 className="mr-1 size-3" /> Aprovar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[10px]"
          disabled={disabled || requiresApproval}
          title={
            requiresApproval
              ? "Aprove antes de executar; a execução automática foi bloqueada."
              : undefined
          }
          onClick={() => onExecute(execution)}
        >
          <PlayCircle className="mr-1 size-3" /> Executar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[10px]"
          disabled={disabled}
          onClick={() => onCancel(execution)}
        >
          <XCircle className="mr-1 size-3" /> Cancelar
        </Button>
      </div>
    </article>
  );
}

export function WhatsAppExecutionHistoryItem({
  execution,
}: {
  execution: WhatsAppActionExecution;
}) {
  const timestamp =
    execution.executedAt ??
    execution.failedAt ??
    execution.cancelledAt ??
    execution.approvedAt ??
    execution.createdAt;
  return (
    <article className="rounded-xl bg-app-surface px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-medium text-[var(--text-secondary)]">
          {whatsappActionLabel(execution.suggestedAction)}
        </p>
        <WhatsAppExecutionStatusBadge status={execution.status} />
      </div>
      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
        {formatWhatsAppExecutionDate(timestamp)}
      </p>
      <p className="mt-1 line-clamp-1 text-[10px] text-[var(--text-muted)]">
        {compactWhatsAppPayloadSummary(execution.actionPayload)}
      </p>
      {execution.failureReason ? (
        <p className="mt-1 line-clamp-2 text-[10px] text-[var(--danger)]">
          {execution.failureReason}
        </p>
      ) : null}
    </article>
  );
}

export function WhatsAppActionExecutionPanel({
  pendingApprovals,
  history,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  onApprove,
  onExecute,
  onCancel,
  isMutating,
}: {
  pendingApprovals: WhatsAppActionExecution[];
  history: WhatsAppActionExecution[];
  isLoading: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  onApprove: (execution: WhatsAppActionExecution) => void;
  onExecute: (execution: WhatsAppActionExecution) => void;
  onCancel: (execution: WhatsAppActionExecution) => void;
  isMutating: boolean;
}) {
  const recentHistory = history.slice(0, 5);
  return (
    <section className="space-y-3 px-1 py-1">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
            Execução assistida
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Aprovação humana para ações sensíveis, sem autoexecução.
          </p>
        </div>
        <span className="rounded-full bg-[color-mix(in_srgb,var(--warning)_14%,var(--app-surface))] px-2 py-0.5 text-[10px] text-[var(--warning)]">
          {pendingApprovals.length} pendente(s)
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-label="Carregando aprovações WhatsApp">
          <AppSkeleton className="h-20 rounded-xl" />
          <AppSkeleton className="h-14 rounded-xl" />
        </div>
      ) : isError ? (
        <div className="rounded-xl bg-[color-mix(in_srgb,var(--danger)_10%,var(--app-surface))] p-3 text-[11px] text-[var(--danger)]">
          <p className="font-medium">Falha ao carregar execuções assistidas.</p>
          <p className="mt-1">
            {errorMessage ??
              "Tente atualizar a conversa antes de aprovar ações."}
          </p>
          {onRetry ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 h-7 px-2 text-[10px]"
              onClick={onRetry}
            >
              Tentar novamente
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Aguardando aprovação
              </p>
              {isMutating ? (
                <span className="text-[10px] text-[var(--text-muted)]">
                  Processando...
                </span>
              ) : null}
            </div>
            {pendingApprovals.length > 0 ? (
              <div className="space-y-2">
                {pendingApprovals.slice(0, 3).map(execution => (
                  <WhatsAppPendingApprovalCard
                    key={execution.id}
                    execution={execution}
                    disabled={isMutating}
                    onApprove={onApprove}
                    onExecute={onExecute}
                    onCancel={onCancel}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-app-surface p-3 text-[11px] text-app-muted">
                Nenhuma aprovação pendente para esta conversa.
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Histórico recente
            </p>
            {recentHistory.length > 0 ? (
              <div className="space-y-1.5">
                {recentHistory.map(execution => (
                  <WhatsAppExecutionHistoryItem
                    key={execution.id}
                    execution={execution}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-app-surface p-3 text-[11px] text-app-muted">
                Nenhuma execução recente registrada para esta conversa.
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
