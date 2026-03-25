import { Button } from "@/components/ui/button";
import { Pencil, AlertCircle } from "lucide-react";

import type { ServiceOrder, StageTone } from "./service-order.types";

import {
  formatCurrency,
  formatDateTime,
  normalizeStatus,
} from "@/lib/operations/operations.utils";

import { getServiceOrderNextAction } from "@/lib/operations/operations.selectors";

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

function getStatusLabel(status: string) {
  if (status === "DONE") return "Concluído";
  if (status === "IN_PROGRESS") return "Em execução";
  if (status === "OPEN") return "Aberto";
  if (status === "ASSIGNED") return "Atribuído";
  return status;
}

function getCardToneClass(tone: string) {
  if (tone === "red") return "border-red-500 ring-2 ring-red-200";
  if (tone === "amber") return "border-amber-400";
  if (tone === "blue") return "border-blue-400";
  if (tone === "green") return "border-green-400";
  return "";
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
  const status = normalizeStatus(os.status);

  const lastActivityAt =
    os.updatedAt || os.finishedAt || os.startedAt || os.createdAt;

  const timeAgo = formatTimeAgo(lastActivityAt);

  const nextAction = getServiceOrderNextAction(os);

  const disabled = isProcessing || isUpdating;

  return (
    <div
      onClick={() => onOpenDeepLink(os.id)}
      className={`rounded-xl border p-4 transition cursor-pointer hover:bg-gray-50 ${getCardToneClass(
        nextAction.tone
      )}`}
    >
      <div className="flex flex-col gap-3">

        {/* HEADER */}
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{os.title}</h3>

          <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">
            {getStatusLabel(status)}
          </span>

          <span className={`px-2 py-0.5 text-xs rounded ${chargeBadge.className}`}>
            {chargeBadge.label}
          </span>

          <span className="text-xs text-gray-400">{timeAgo}</span>

          {nextAction.tone === "red" && (
            <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
              <AlertCircle className="h-3 w-3" />
              Ação urgente
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

        {/* NEXT ACTION */}
        <div className="text-xs text-gray-600">
          {nextAction.title}
        </div>

        {/* INFO */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span>
            {typeof os.amountCents === "number" && os.amountCents > 0
              ? formatCurrency(os.amountCents)
              : "Sem valor"}
          </span>

          <span>
            {os.scheduledFor
              ? formatDateTime(os.scheduledFor)
              : "Sem agendamento"}
          </span>

          <span>
            {os.dueDate
              ? formatDateTime(os.dueDate)
              : "Sem vencimento"}
          </span>
        </div>

        {/* ACTION */}
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
