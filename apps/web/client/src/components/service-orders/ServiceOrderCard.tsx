import { Button } from "@/components/ui/button";
import {
  Wallet,
  Pencil,
  AlertCircle,
  History,
  ReceiptText,
} from "lucide-react";
import type { ServiceOrder, StageTone } from "./service-order.types";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  formatCurrency,
  formatDateTime,
  getPriorityColor,
  getPriorityLabel,
  getLastActivityAt,
  isAbandoned,
  isReadyToCharge,
} from "./service-order.utils";
import { normalizeStatus } from "@/lib/operations/operations.utils";

interface Props {
  os: ServiceOrder;
  isProcessing: boolean;
  chargeBadge: { label: string; className: string };

  operationalStage: StageTone;
  financialStage: StageTone;

  onEdit: (id: string) => void;
  onOpenDeepLink: (id: string) => void;

  isUpdating: boolean;
}

function formatTimeAgo(date?: string | Date | null) {
  if (!date) return "sem atividade";
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "agora";
  if (h < 24) return `há ${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function ServiceOrderCard({
  os,
  isProcessing,
  chargeBadge,
  operationalStage,
  financialStage,
  onEdit,
  onOpenDeepLink,
  isUpdating,
}: Props) {
  const lastActivityAt = getLastActivityAt(os);
  const timeAgo = formatTimeAgo(lastActivityAt);

  const status = normalizeStatus(os.status);

  const abandoned = isAbandoned(os);
  const isChargeMissingAfterDone = isReadyToCharge(os);

  const disabled = isProcessing || isUpdating;

  return (
    <div
      onClick={() => onOpenDeepLink(os.id)}
      className={`rounded-xl border p-4 transition cursor-pointer hover:bg-gray-50 ${
        isChargeMissingAfterDone ? "border-red-500 ring-2 ring-red-200" : ""
      }`}
    >
      <div className="flex flex-col gap-3">

        {/* HEADER */}
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{os.title}</h3>

          <span className={`px-2 py-0.5 text-xs rounded ${STATUS_COLORS[status]}`}>
            {STATUS_LABELS[status]}
          </span>

          <span className={`text-xs ${getPriorityColor(os.priority)}`}>
            ● {getPriorityLabel(os.priority)}
          </span>

          <span className={`px-2 py-0.5 text-xs rounded ${chargeBadge.className}`}>
            {chargeBadge.label}
          </span>

          <span className="text-xs text-gray-400">{timeAgo}</span>

          {abandoned && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
              <AlertCircle className="h-3 w-3" />
              Abandonada
            </span>
          )}
        </div>

        {/* STAGES */}
        <div className="flex flex-wrap gap-2">
          <span className={`px-2 py-1 text-xs rounded border ${operationalStage.className}`}>
            {operationalStage.label}
          </span>

          <span className={`px-2 py-1 text-xs rounded border ${financialStage.className}`}>
            {financialStage.label}
          </span>
        </div>

        {/* ALERTA */}
        {isChargeMissingAfterDone && (
          <div className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
            💰 Execução concluída sem cobrança
          </div>
        )}

        {/* INFO */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Wallet className="h-3.5 w-3.5" />
            {typeof os.amountCents === "number" && os.amountCents > 0
              ? formatCurrency(os.amountCents)
              : "Sem valor"}
          </span>

          <span className="inline-flex items-center gap-1">
            <History className="h-3.5 w-3.5" />
            {os.scheduledFor
              ? formatDateTime(os.scheduledFor)
              : "Sem agendamento"}
          </span>

          <span className="inline-flex items-center gap-1">
            <ReceiptText className="h-3.5 w-3.5" />
            {os.dueDate ? formatDateTime(os.dueDate) : "Sem vencimento"}
          </span>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(os.id);
            }}
            disabled={disabled}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>

      </div>
    </div>
  );
}
