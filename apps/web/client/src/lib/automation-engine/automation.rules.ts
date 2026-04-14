import type { AutomationRule } from "./automation.types";

const HOUR_MS = 60 * 60 * 1000;

export const defaultAutomationRules: AutomationRule[] = [
  {
    id: "rule-overdue-charge-whatsapp",
    name: "Cobrança vencida > WhatsApp imediato",
    enabled: true,
    autoExecute: true,
    condition: (decision) => decision.source === "finance" && decision.id.startsWith("finance-overdue-"),
  },
  {
    id: "rule-customer-no-response-followup",
    name: "Cliente sem resposta > follow-up em 24h",
    enabled: true,
    autoExecute: true,
    delayMs: 24 * HOUR_MS,
    condition: (decision) => decision.source === "whatsapp" && decision.id.startsWith("whatsapp-no-reply-"),
  },
  {
    id: "rule-service-order-completed-billing",
    name: "OS concluída > gerar cobrança",
    enabled: true,
    autoExecute: true,
    condition: (decision) =>
      decision.source === "service-order" &&
      (decision.title.toLowerCase().includes("conclu") || decision.description.toLowerCase().includes("gerar cobrança")),
  },
];
