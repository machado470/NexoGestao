import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { normalizeList } from "@/lib/utils/normalizeList";
import ServiceOrderDetailsPanel from "@/components/service-orders/ServiceOrderDetailsPanel";
import {
  Wallet,
  Link2,
  Pencil,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  History,
  Play,
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
  getPriorityScore,
} from "./service-order.utils";

interface Props {
  os: ServiceOrder;
  isExpanded: boolean;
  isProcessing: boolean;
  chargeBadge: { label: string; className: string };
  canGenerateCharge: boolean;
  canStartExecution: boolean;

  operationalStage: StageTone;
  financialStage: StageTone;

  onEdit: (id: string) => void;
  onStartExecution: (os: ServiceOrder) => void;
  onFinishExecution: (os: ServiceOrder) => void;
  onGenerateCharge: (os: ServiceOrder) => void;
  onOpenDeepLink: (id: string) => void;
  onToggleExpanded: (id: string) => void;

  isUpdating: boolean;
  isStartingExecution: boolean;
  isFinishingExecution: boolean;
  isGeneratingCharge: boolean;
}

function formatTimeAgo(date?: string | Date | null) {
  if (!date) return "sem atividade";
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "agora";
  if (h < 24) return `há ${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function normalizeTimelineRows(data: unknown) {
  return normalizeList<any>(data);
}

export default function ServiceOrderCard({
  os,
  isExpanded,
  isProcessing,
  chargeBadge,
  canGenerateCharge,
  canStartExecution,
  operationalStage,
  financialStage,
  onEdit,
  onStartExecution,
  onFinishExecution,
  onGenerateCharge,
  onOpenDeepLink,
  onToggleExpanded,
  isUpdating,
  isStartingExecution,
  isFinishingExecution,
  isGeneratingCharge,
}: Props) {
  const timelineQuery = trpc.nexo.timeline.listByServiceOrder.useQuery(
    { serviceOrderId: os.id, limit: 1 },
    { retry: false },
  );

  const lastEvent = useMemo(() => {
    const events = normalizeTimelineRows(timelineQuery.data);
    return events[0] ?? null;
  }, [timelineQuery.data]);

  const lastActivityAt = lastEvent?.createdAt || getLastActivityAt(os);
  const timeAgo = formatTimeAgo(lastActivityAt);

  const abandoned = isAbandoned(os);
  const score = getPriorityScore(os);

  const isMoneyBlocked = financialStage.label === "Pronta para cobrança";

  const disabled =
    isProcessing ||
    isUpdating ||
    isStartingExecution ||
    isFinishingExecution ||
    isGeneratingCharge;

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        isMoneyBlocked ? "border-red-500 ring-2 ring-red-200" : ""
      }`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{os.title}</h3>

              <span
                className={`px-2 py-0.5 text-xs rounded ${STATUS_COLORS[os.status]}`}
              >
                {STATUS_LABELS[os.status]}
              </span>

              <span className={`text-xs ${getPriorityColor(os.priority)}`}>
                ● {getPriorityLabel(os.priority)}
              </span>

              <span
                className={`px-2 py-0.5 text-xs rounded ${chargeBadge.className}`}
              >
                {chargeBadge.label}
              </span>

              <span className="text-xs text-gray-400">{timeAgo}</span>

              {abandoned && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                  <AlertCircle className="h-3 w-3" />
                  Abandonada
                </span>
              )}

              <span className="text-xs text-gray-400">score {score}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className={`px-2 py-1 text-xs rounded border ${operationalStage.className}`}
              >
                <operationalStage.icon className="inline h-3 w-3 mr-1" />
                {operationalStage.label}
              </span>

              <span
                className={`px-2 py-1 text-xs rounded border ${financialStage.className}`}
              >
                <financialStage.icon className="inline h-3 w-3 mr-1" />
                {financialStage.label}
              </span>
            </div>

            {isMoneyBlocked && (
              <div className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                💰 Execução concluída sem cobrança → dinheiro parado
              </div>
            )}

            <p className="text-sm text-gray-500">
              {os.description || "Sem descrição"}
            </p>

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
          </div>

          <div className="flex flex-wrap gap-2">
            {canGenerateCharge && (
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                onClick={() => onGenerateCharge(os)}
                disabled={disabled}
              >
                💰 Gerar cobrança
              </Button>
            )}

            <Button size="sm" onClick={() => onEdit(os.id)} disabled={disabled}>
              <Pencil className="h-4 w-4" />
            </Button>

            <Button
              size="sm"
              onClick={() => onStartExecution(os)}
              disabled={!canStartExecution || disabled}
            >
              <Play className="h-4 w-4" />
            </Button>

            <Button
              size="sm"
              onClick={() => onFinishExecution(os)}
              disabled={os.status !== "IN_PROGRESS" || disabled}
            >
              Finalizar
            </Button>

            <Button size="sm" onClick={() => onOpenDeepLink(os.id)}>
              <Link2 className="h-4 w-4" />
            </Button>

            <Button size="sm" onClick={() => onToggleExpanded(os.id)}>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {isExpanded && <ServiceOrderDetailsPanel os={os} />}
      </div>
    </div>
  );
}
