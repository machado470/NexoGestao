export type ActionFlowEvent = "customer_created" | "service_order_created" | "charge_created";

export type NextActionSuggestion = {
  title: string;
  description: string;
  ctaLabel: string;
  ctaPath: string;
};

const STORAGE_KEY = "nexo:last-action-flow";

const FLOW_MAP: Record<ActionFlowEvent, NextActionSuggestion> = {
  customer_created: {
    title: "Próximo passo automático: criar agendamento",
    description: "Cliente criado. Agende agora para transformar cadastro em serviço faturável.",
    ctaLabel: "Criar agendamento",
    ctaPath: "/appointments",
  },
  service_order_created: {
    title: "Próximo passo automático: gerar cobrança",
    description: "O.S. criada. Gere a cobrança agora para evitar dinheiro parado.",
    ctaLabel: "Gerar cobrança",
    ctaPath: "/finances",
  },
  charge_created: {
    title: "Próximo passo automático: enviar WhatsApp",
    description: "Cobrança criada. Envie o lembrete para aumentar recebimento hoje.",
    ctaLabel: "Abrir WhatsApp",
    ctaPath: "/whatsapp",
  },
};

export function registerActionFlowEvent(event: ActionFlowEvent) {
  if (typeof window === "undefined") return;

  const payload = {
    event,
    createdAt: Date.now(),
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function getLatestActionFlowSuggestion(): NextActionSuggestion | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { event?: ActionFlowEvent; createdAt?: number };
    if (!parsed.event || !(parsed.event in FLOW_MAP)) return null;

    return FLOW_MAP[parsed.event];
  } catch {
    return null;
  }
}
