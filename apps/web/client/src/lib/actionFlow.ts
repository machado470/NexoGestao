import type { PriorityPageContext } from "@/lib/priorityEngine";

export type ActionFlowEvent =
  | "customer_created"
  | "service_order_created"
  | "charge_created"
  | "appointment_created"
  | "person_created"
  | "page_primary_cta_clicked";

export type NextActionSuggestion = {
  title: string;
  description: string;
  ctaLabel: string;
  ctaPath: string;
};

type ActionFlowPayload = {
  event: ActionFlowEvent;
  pageContext?: PriorityPageContext;
  ctaPath?: string;
  createdAt: number;
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
  appointment_created: {
    title: "Próximo passo automático: abrir ordem de serviço",
    description: "Agendamento criado. Puxe a execução para não perder ritmo de operação.",
    ctaLabel: "Abrir O.S.",
    ctaPath: "/service-orders",
  },
  person_created: {
    title: "Próximo passo automático: distribuir fila",
    description: "Pessoa cadastrada. Faça o balanceamento de O.S. e reduza gargalos.",
    ctaLabel: "Gerir equipe",
    ctaPath: "/people",
  },
  page_primary_cta_clicked: {
    title: "Próximo passo automático: manter tração",
    description: "Ação iniciada. Siga o fluxo sugerido para não perder o próximo ganho operacional.",
    ctaLabel: "Continuar",
    ctaPath: "/dashboard",
  },
};

const CONTEXT_DEFAULT_SUGGESTION: Record<PriorityPageContext, NextActionSuggestion> = {
  dashboard: {
    title: "Resolva o maior bloqueio financeiro",
    description: "Comece pelo item crítico para liberar caixa e acelerar o ciclo de entrega.",
    ctaLabel: "Ir para financeiro",
    ctaPath: "/finances",
  },
  customers: {
    title: "Ative cliente em operação",
    description: "Selecione um cliente e puxe um agendamento ou execução agora.",
    ctaLabel: "Abrir clientes",
    ctaPath: "/customers",
  },
  finances: {
    title: "Recuperar cobrança vencida",
    description: "Priorize a cobrança atrasada com maior impacto no caixa.",
    ctaLabel: "Priorizar cobranças",
    ctaPath: "/finances",
  },
  "service-orders": {
    title: "Destravar ordem de serviço parada",
    description: "Abra a próxima O.S. da fila e mova o ciclo para faturamento.",
    ctaLabel: "Abrir fila operacional",
    ctaPath: "/service-orders",
  },
  appointments: {
    title: "Confirmar ou converter agendamento",
    description: "Confirme presença e puxe a O.S. para evitar perda de agenda.",
    ctaLabel: "Ver agendamentos",
    ctaPath: "/appointments",
  },
  people: {
    title: "Balancear carga da equipe",
    description: "Distribua O.S. sem responsável para reduzir gargalos da operação.",
    ctaLabel: "Ver pessoas",
    ctaPath: "/people",
  },
};

export function registerActionFlowEvent(
  event: ActionFlowEvent,
  options?: { pageContext?: PriorityPageContext; ctaPath?: string }
) {
  if (typeof window === "undefined") return;

  const payload: ActionFlowPayload = {
    event,
    pageContext: options?.pageContext,
    ctaPath: options?.ctaPath,
    createdAt: Date.now(),
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function getNextActionSuggestion(pageContext: PriorityPageContext): NextActionSuggestion {
  if (typeof window === "undefined") return CONTEXT_DEFAULT_SUGGESTION[pageContext];

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return CONTEXT_DEFAULT_SUGGESTION[pageContext];

  try {
    const parsed = JSON.parse(raw) as ActionFlowPayload;
    const suggestion = parsed.event ? FLOW_MAP[parsed.event] : null;

    if (!suggestion) return CONTEXT_DEFAULT_SUGGESTION[pageContext];

    if (parsed.event === "page_primary_cta_clicked" && parsed.ctaPath) {
      return {
        ...suggestion,
        ctaPath: parsed.ctaPath,
      };
    }

    return suggestion;
  } catch {
    return CONTEXT_DEFAULT_SUGGESTION[pageContext];
  }
}

export function getLatestActionFlowSuggestion(): NextActionSuggestion | null {
  return getNextActionSuggestion("dashboard");
}
