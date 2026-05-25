export type OperationalSeverity =
  | "CRITICAL"
  | "WARNING"
  | "ATTENTION"
  | "NORMAL"
  | "SUCCESS"
  | "INACTIVE";

export type OperationalActionIntent =
  | "primary"
  | "attention"
  | "destructive"
  | "contextual"
  | "passive";

export type OperationalEventType =
  | "creation"
  | "update"
  | "billing"
  | "payment"
  | "whatsapp"
  | "service_order"
  | "appointment"
  | "governance"
  | "automation";

const severityAliases: Record<string, OperationalSeverity> = {
  critical: "CRITICAL",
  crítico: "CRITICAL",
  em_risco: "CRITICAL",
  danger: "CRITICAL",
  urgente: "CRITICAL",
  failed: "CRITICAL",
  falhou: "CRITICAL",
  blocked: "CRITICAL",
  bloqueado: "CRITICAL",

  warning: "WARNING",
  overdue: "WARNING",
  atrasado: "WARNING",
  em_atraso: "WARNING",
  alert: "WARNING",

  attention: "ATTENTION",
  atenção: "ATTENTION",
  high: "ATTENTION",
  alta: "ATTENTION",
  alto: "ATTENTION",
  medium: "ATTENTION",
  médio: "ATTENTION",
  pending: "ATTENTION",
  pendente: "ATTENTION",

  normal: "NORMAL",
  info: "NORMAL",
  confirmado: "NORMAL",
  confirmed: "NORMAL",

  success: "SUCCESS",
  ok: "SUCCESS",
  done: "SUCCESS",
  concluído: "SUCCESS",
  pago: "SUCCESS",
  paid: "SUCCESS",
  healthy: "SUCCESS",
  seguro: "SUCCESS",

  inactive: "INACTIVE",
  inativo: "INACTIVE",
  stalled: "INACTIVE",
};

const severityLabelMap: Record<OperationalSeverity, string> = {
  CRITICAL: "Risco crítico",
  WARNING: "Atenção imediata",
  ATTENTION: "Aguardando ação",
  NORMAL: "Operação normal",
  SUCCESS: "Concluído",
  INACTIVE: "Sem atividade recente",
};

const severityToneMap: Record<
  OperationalSeverity,
  "danger" | "warning" | "accent" | "info" | "success" | "neutral"
> = {
  CRITICAL: "danger",
  WARNING: "warning",
  ATTENTION: "accent",
  NORMAL: "info",
  SUCCESS: "success",
  INACTIVE: "neutral",
};

export function normalizeOperationalSeverity(input: string | null | undefined): OperationalSeverity {
  const raw = (input ?? "").toString().trim().toLowerCase().replace(/ /g, "_");
  return severityAliases[raw] ?? "ATTENTION";
}

export function operationalSeverityLabel(input: string | OperationalSeverity): string {
  const normalized = normalizeOperationalSeverity(input);
  return severityLabelMap[normalized];
}

export function operationalSeverityTone(input: string | OperationalSeverity) {
  const normalized = normalizeOperationalSeverity(input);
  return severityToneMap[normalized];
}

export const operationalCopy = {
  nextBestAction: "Próxima melhor ação",
  immediateAttention: "Atenção imediata",
  waitingCustomer: "Aguardando cliente",
  overdue: "Em atraso",
  criticalRisk: "Risco crítico",
  noRecentActivity: "Sem atividade recente",
  overdueBilling: "Cobrança vencida",
  operationalFailure: "Falha operacional",
  missingOwner: "Sem responsável",
  updatingData: "Atualizando dados",
  noEventsFound: "Nenhum evento encontrado",
} as const;

export const operationalTimelineLabels: Record<OperationalEventType, string> = {
  creation: "Criação",
  update: "Atualização",
  billing: "Cobrança",
  payment: "Pagamento",
  whatsapp: "WhatsApp",
  service_order: "O.S.",
  appointment: "Agendamento",
  governance: "Governança",
  automation: "Automação",
};
