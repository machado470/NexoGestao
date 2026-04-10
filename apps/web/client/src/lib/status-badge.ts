export type StatusTone = "success" | "warning" | "danger" | "neutral" | "info";

export function mapFinanceStatus(status?: string | null): {
  label: string;
  tone: StatusTone;
} {
  switch (String(status ?? "").toUpperCase()) {
    case "PAID":
      return { label: "Pago", tone: "success" };
    case "PENDING":
      return { label: "Pendente", tone: "warning" };
    case "OVERDUE":
      return { label: "Vencido", tone: "danger" };
    case "CANCELED":
      return { label: "Cancelado", tone: "neutral" };
    default:
      return { label: "Sem cobrança", tone: "neutral" };
  }
}

export function mapServiceOrderStatus(status?: string | null): {
  label: string;
  tone: StatusTone;
} {
  switch (String(status ?? "").toUpperCase()) {
    case "DONE":
      return { label: "Concluído", tone: "success" };
    case "IN_PROGRESS":
      return { label: "Em execução", tone: "info" };
    case "ASSIGNED":
      return { label: "Atribuído", tone: "warning" };
    case "OPEN":
      return { label: "Aberto", tone: "warning" };
    case "CANCELED":
      return { label: "Cancelado", tone: "neutral" };
    default:
      return { label: status || "Outro", tone: "neutral" };
  }
}

export function mapAppointmentStatus(status?: string | null): {
  label: string;
  tone: StatusTone;
} {
  switch (String(status ?? "").toUpperCase()) {
    case "DONE":
      return { label: "Concluído", tone: "success" };
    case "CONFIRMED":
      return { label: "Confirmado", tone: "info" };
    case "SCHEDULED":
      return { label: "Agendado", tone: "warning" };
    case "NO_SHOW":
      return { label: "Não compareceu", tone: "danger" };
    case "CANCELED":
      return { label: "Cancelado", tone: "neutral" };
    default:
      return { label: status || "Sem status", tone: "neutral" };
  }
}
