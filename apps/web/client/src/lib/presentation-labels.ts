/** Presentation only: never use translated labels as API filters or persisted codes. */
export const PRESENTATION_LABELS: Record<string, string> = {
  SERVICE_ORDER_STATUS_CHANGED: "Status da O.S. alterado", SERVICE_ORDER_ASSIGNED_CHANGED: "Responsável da O.S. alterado",
  SERVICE_ORDER_ATTACHMENT_ADDED: "Anexo incluído na O.S.", SERVICE_ORDER_ATTACHMENT_REMOVED: "Anexo removido da O.S.",
  CUSTOMER_ACTIVE_CHANGED: "Situação do cliente alterada", APPOINTMENT_STATUS_CHANGED: "Status do agendamento alterado", APPOINTMENT_CONFLICT_BLOCKED: "Conflito de agenda bloqueado",
  CHARGE_PAID: "Cobrança paga", PAYMENT_CREATED: "Pagamento registrado", CHARGE_DELETED: "Cobrança removida", EXECUTION_COMPLETED: "Execução concluída", CORRECTIVE_ACTION_RESOLVED: "Ação corretiva resolvida",
  GOVERNANCE: "Governança", RISK: "Risco", FINANCE: "Financeiro", TIMELINE: "Histórico", DIAGNOSTIC: "Diagnóstico", GOVERNANCE_RUN_STALE: "Avaliação de governança desatualizada", RISK_SNAPSHOT_STALE: "Avaliação de risco desatualizada",
  Customer: "Cliente", ServiceOrder: "Ordem de serviço", Appointment: "Agendamento", Person: "Pessoa", Charge: "Cobrança", Payment: "Pagamento",
  customer: "Cliente", customers: "Clientes", service_order: "Ordem de serviço", service_orders: "Ordens de serviço", appointment: "Agendamento", appointments: "Agendamentos", finance: "Financeiro", governance: "Governança", risk: "Risco", system: "Sistema", whatsapp: "WhatsApp",
  BRL: "Real (BRL)", USD: "Dólar (USD)", EUR: "Euro (EUR)",
  UNKNOWN: "Não informado", NORMAL: "Operação normal", WARNING: "Em atenção", RESTRICTED: "Operação restrita", SUSPENDED: "Operação suspensa",
  AVAILABLE: "Disponível", NO_DATA: "Sem avaliação", UNAVAILABLE: "Indisponível",
  UNDER_CAPACITY: "Abaixo da capacidade", AT_CAPACITY: "Na capacidade", OVER_CAPACITY: "Acima da capacidade",
  CUSTOMER_CREATED: "Cliente cadastrado", CUSTOMER_UPDATED: "Cliente atualizado", CUSTOMER_DELETED: "Cliente removido",
  APPOINTMENT_CREATED: "Agendamento criado", APPOINTMENT_UPDATED: "Agendamento atualizado", APPOINTMENT_CANCELED: "Agendamento cancelado",
  SERVICE_ORDER_CREATED: "O.S. criada", SERVICE_ORDER_UPDATED: "O.S. atualizada", SERVICE_ORDER_STARTED: "O.S. iniciada", SERVICE_ORDER_DONE: "O.S. concluída",
  CHARGE_CREATED: "Cobrança criada", CHARGE_UPDATED: "Cobrança atualizada", CHARGE_CANCELED: "Cobrança cancelada", PAYMENT_RECEIVED: "Pagamento recebido",
  ORGANIZATION_UPDATED: "Organização atualizada", PERSON_UPDATED: "Pessoa atualizada", PERSON_CREATED: "Pessoa cadastrada",
  GOVERNANCE_RUN: "Avaliação de governança", CUSTOMER: "Cliente", SERVICE_ORDER: "Ordem de serviço", APPOINTMENT: "Agendamento",
  CRITICAL: "Crítico", HIGH: "Alto", MEDIUM: "Médio", LOW: "Baixo", INFO: "Informativo", SUCCESS: "Concluído",
};
export function presentationLabel(value: unknown): string {
  if (value == null || value === "") return "Não informado";
  const code = String(value);
  return Object.prototype.hasOwnProperty.call(PRESENTATION_LABELS, code) ? PRESENTATION_LABELS[code] : (/^[A-Z][A-Z0-9_]+$/.test(code) ? `Não reconhecido (${code})` : code);
}
