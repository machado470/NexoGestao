const STATUS_LABELS: Record<string, string> = {
  NORMAL: "Operação saudável",
  WARNING: "Atenção necessária",
  RESTRICTED: "Operação comprometida",
  SUSPENDED: "Operação bloqueada",
  CRITICAL: "Condição crítica",
  HIGH: "Alta prioridade",
  MEDIUM: "Prioridade moderada",
  LOW: "Baixa prioridade",
  PENDING: "Aguardando ação",
  COMPLETED: "Concluído",
  DONE: "Concluído",
  CANCELED: "Cancelado",
  CANCELLED: "Cancelado",
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  OVERDUE: "Em atraso",
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  NO_SHOW: "Não compareceu",
  OPEN: "Aberto",
  ASSIGNED: "Atribuído",
  IN_PROGRESS: "Em execução",
  PAID: "Pago",
  FAILED: "Falhou",
  DELIVERED: "Entregue",
  READ: "Lida",
  SENT: "Enviada",
  QUEUED: "Na fila",
  RECEIVED: "Recebido",
  PROCESSING: "Em processamento",
  PROCESSED: "Processado",
  DEGRADED: "Operação degradada",
  OK: "Operação estável",
};

export function presentationStatusLabel(status?: string | null, fallback = "--") {
  const raw = String(status ?? "").trim();
  if (!raw) return fallback;
  const normalized = raw.toUpperCase().replace(/[\s-]+/g, "_");
  return STATUS_LABELS[normalized] ?? raw;
}
