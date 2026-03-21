import { Button } from "@/components/ui/button";
import ServiceOrderDetailsPanel from "@/components/service-orders/ServiceOrderDetailsPanel";
import {
  User,
  Wallet,
  Link2,
  Pencil,
  ChevronDown,
  ChevronUp,
  FileText,
  Ban,
} from "lucide-react";
import type {
  ServiceOrder,
  ServiceOrderStatus,
  StageTone,
} from "./service-order.types";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  formatCurrency,
  formatDate,
  formatDateTime,
  getPriorityColor,
  getPriorityLabel,
} from "./service-order.utils";

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

function OperationalClosureCard({ os }: { os: ServiceOrder }) {
  if (os.status === "DONE") {
    return (
      <div
        className={`rounded-lg border p-3 ${
          os.outcomeSummary?.trim()
            ? "border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300"
            : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300"
        }`}
      >
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Fechamento operacional</p>
            <p className="mt-1 text-xs opacity-90">
              {os.outcomeSummary?.trim()
                ? os.outcomeSummary
                : "O.S. concluída sem resumo final registrado."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (os.status === "CANCELED") {
    return (
      <div
        className={`rounded-lg border p-3 ${
          os.cancellationReason?.trim()
            ? "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300"
            : "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
        }`}
      >
        <div className="flex items-start gap-2">
          <Ban className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Motivo do cancelamento</p>
            <p className="mt-1 text-xs opacity-90">
              {os.cancellationReason?.trim()
                ? os.cancellationReason
                : "O.S. cancelada sem motivo registrado."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function ServiceOrderCard({
  os,
  isHighlighted,
  isExpanded,
  isProcessing,
  chargeBadge,
  canGenerateCharge,
  canStartExecution,
  operationalStage,
  financialStage,
  onEdit,
  onStatusChange,
  onStartExecution,
  onFinishExecution,
  onGenerateCharge,
  onOpenCharge,
  onOpenDeepLink,
  onToggleExpanded,
  isUpdating,
  isStartingExecution,
  isFinishingExecution,
  isGeneratingCharge,
}: {
  os: ServiceOrder;
  isHighlighted: boolean;
  isExpanded: boolean;
  isProcessing: boolean;
  chargeBadge: { label: string; className: string };
  canGenerateCharge: boolean;
  canStartExecution: boolean;
  operationalStage: StageTone;
  financialStage: StageTone;
  onEdit: (serviceOrderId: string) => void;
  onStatusChange: (
    serviceOrder: ServiceOrder,
    newStatus: ServiceOrderStatus
  ) => void;
  onStartExecution: (serviceOrder: ServiceOrder) => void;
  onFinishExecution: (serviceOrder: ServiceOrder) => void;
  onGenerateCharge: (serviceOrder: ServiceOrder) => void;
  onOpenCharge: (serviceOrderId: string) => void;
  onOpenDeepLink: (serviceOrderId: string) => void;
  onToggleExpanded: (serviceOrderId: string) => void;
  isUpdating: boolean;
  isStartingExecution: boolean;
  isFinishingExecution: boolean;
  isGeneratingCharge: boolean;
}) {
  const hasAssignedPerson = Boolean(os.assignedToPersonId);
  const financialSummary = os.financialSummary ?? null;
  const OperationalIcon = operationalStage.icon;
  const FinancialIcon = financialStage.icon;

  return (
    <div
      className={`rounded-xl border bg-white p-4 transition-shadow hover:shadow-md dark:bg-gray-800 ${
        isHighlighted
          ? "border-orange-400 ring-2 ring-orange-200 dark:border-orange-500 dark:ring-orange-900/40"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                {os.title}
              </h3>

              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[os.status]}`}
              >
                {STATUS_LABELS[os.status]}
              </span>

              <span
                className={`text-xs font-medium ${getPriorityColor(os.priority)}`}
              >
                ● {getPriorityLabel(os.priority)}
              </span>

              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${chargeBadge.className}`}
              >
                {chargeBadge.label}
              </span>

              {isHighlighted ? (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                  Em foco
                </span>
              ) : null}
            </div>

            {os.description ? (
              <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                {os.description}
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
                Sem descrição operacional.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(os.id)}
              className="gap-2"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Button>

            <select
              value={os.status}
              onChange={(e) =>
                onStatusChange(os, e.target.value as ServiceOrderStatus)
              }
              disabled={
                isUpdating ||
                isProcessing ||
                isStartingExecution ||
                isFinishingExecution ||
                os.status === "DONE" ||
                os.status === "CANCELED"
              }
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
              <option value="OPEN">Aberta</option>
              <option value="ASSIGNED" disabled={!hasAssignedPerson}>
                Atribuída
              </option>
              <option value="IN_PROGRESS" disabled={!hasAssignedPerson}>
                Em andamento
              </option>
              <option value="DONE">Concluída</option>
              <option value="CANCELED">Cancelada</option>
            </select>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onStartExecution(os)}
              disabled={
                !canStartExecution ||
                isUpdating ||
                isStartingExecution ||
                isFinishingExecution ||
                isProcessing
              }
            >
              Iniciar
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onFinishExecution(os)}
              disabled={
                os.status !== "IN_PROGRESS" ||
                isUpdating ||
                isStartingExecution ||
                isFinishingExecution ||
                isProcessing
              }
            >
              Finalizar
            </Button>

            <Button
              size="sm"
              variant={canGenerateCharge ? "default" : "outline"}
              onClick={() => {
                if (canGenerateCharge) {
                  onGenerateCharge(os);
                  return;
                }

                if (financialSummary?.hasCharge) {
                  onOpenCharge(os.id);
                }
              }}
              disabled={isGeneratingCharge || isFinishingExecution || isProcessing}
              className="gap-2"
            >
              <Wallet className="h-4 w-4" />
              {canGenerateCharge
                ? "Gerar cobrança"
                : financialSummary?.hasCharge
                  ? "Ver cobrança"
                  : "Cobrança indisponível"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenDeepLink(os.id)}
              className="gap-2"
            >
              <Link2 className="h-4 w-4" />
              Focar
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onToggleExpanded(os.id)}
              className="gap-2"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Recolher
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Expandir
                </>
              )}
            </Button>
          </div>
        </div>

        {!hasAssignedPerson && os.status !== "DONE" && os.status !== "CANCELED" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
            <div className="flex items-start gap-2">
              <User className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Responsável pendente</p>
                <p className="mt-1 text-xs opacity-90">
                  Defina um responsável antes de atribuir ou iniciar a execução.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-2">
          <div className={`rounded-lg border p-3 ${operationalStage.className}`}>
            <div className="flex items-start gap-2">
              <OperationalIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{operationalStage.label}</p>
                <p className="mt-1 text-xs opacity-90">
                  {operationalStage.description}
                </p>
              </div>
            </div>
          </div>

          <div className={`rounded-lg border p-3 ${financialStage.className}`}>
            <div className="flex items-start gap-2">
              <FinancialIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{financialStage.label}</p>
                <p className="mt-1 text-xs opacity-90">
                  {financialStage.description}
                </p>
              </div>
            </div>
          </div>
        </div>

        <OperationalClosureCard os={os} />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoItem label="Cliente" value={os.customer?.name || "Não vinculado"} />
          <InfoItem
            label="Responsável"
            value={os.assignedTo?.name || "Não definido"}
          />
          <InfoItem
            label="Agendado para"
            value={formatDateTime(os.scheduledFor || os.appointment?.startsAt)}
          />
          <InfoItem label="Valor" value={formatCurrency(os.amountCents)} />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoItem label="Criada em" value={formatDate(os.createdAt)} />
          <InfoItem label="Atualizada em" value={formatDate(os.updatedAt)} />
          <InfoItem label="Iniciada em" value={formatDateTime(os.startedAt)} />
          <InfoItem
            label="Finalizada em"
            value={formatDateTime(os.finishedAt)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoItem label="Vencimento" value={formatDate(os.dueDate)} />
          <InfoItem label="Cobrança" value={chargeBadge.label} />
          <InfoItem
            label="Pagamento"
            value={formatDateTime(os.financialSummary?.paidAt)}
          />
          <InfoItem
            label="Janela"
            value={formatDateTime(os.appointment?.endsAt || os.scheduledFor)}
          />
        </div>

        {isExpanded ? <ServiceOrderDetailsPanel os={os} /> : null}
      </div>
    </div>
  );
}
