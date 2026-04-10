import { formatCurrency, formatDate, normalizeStatus } from "@/lib/operations/operations.utils";

export type ExplainLayerContent = {
  reason: string;
  conditions: string[];
  afterAction: string;
};

export function getServiceOrderExplainLayer(order: any): ExplainLayerContent {
  const status = normalizeStatus(order?.status);
  const hasCharge = Boolean(order?.financialSummary?.hasCharge);
  const chargeStatus = normalizeStatus(order?.financialSummary?.chargeStatus);

  if (status === "DONE" && !hasCharge) {
    return {
      reason: "O.S. concluída sem cobrança precisa virar receita.",
      conditions: ["Status da O.S.: concluída", "Nenhuma cobrança vinculada"],
      afterAction: "Após gerar cobrança, o próximo passo é enviar no WhatsApp.",
    };
  }

  if (chargeStatus === "PENDING") {
    return {
      reason: "Cobrança pendente precisa de follow-up para não atrasar.",
      conditions: ["Cobrança em aberto", "Pagamento ainda não confirmado"],
      afterAction: "Depois do lembrete, acompanhe confirmação de pagamento.",
    };
  }

  if (chargeStatus === "OVERDUE") {
    return {
      reason: "Cobrança vencida impacta caixa e deve ser recuperada agora.",
      conditions: ["Cobrança vinculada vencida", "Sem baixa de pagamento"],
      afterAction: "Após contato, gere nova cobrança se o cliente pedir atualização.",
    };
  }

  return {
    reason: "Fluxo operacional está em andamento sem bloqueios críticos.",
    conditions: ["Entrega avançando dentro do status atual"],
    afterAction: "Siga a ação sugerida para manter o fluxo contínuo.",
  };
}

export function getChargeExplainLayer(charge: any): ExplainLayerContent {
  const status = normalizeStatus(charge?.status);
  const amountLabel = formatCurrency(charge?.amountCents);
  const dueDateLabel = charge?.dueDate ? formatDate(charge.dueDate) : "data não informada";

  if (status === "OVERDUE") {
    return {
      reason: "Cobrança vencida exige recuperação imediata.",
      conditions: [`Valor: ${amountLabel}`, `Vencimento: ${dueDateLabel}`],
      afterAction: "Após contato, renegocie ou reemita cobrança para acelerar recebimento.",
    };
  }

  if (status === "PENDING") {
    return {
      reason: "Cobrança pendente sem envio perde velocidade de recebimento.",
      conditions: [`Valor pendente: ${amountLabel}`, "Pagamento ainda não identificado"],
      afterAction: "Após envio no WhatsApp, monitore resposta e confirme pagamento.",
    };
  }

  return {
    reason: "Cobrança sem alerta crítico no momento.",
    conditions: ["Status financeiro regular"],
    afterAction: "Mantenha acompanhamento preventivo da carteira.",
  };
}

export function getAppointmentExplainLayer(appointment: any): ExplainLayerContent {
  const status = normalizeStatus(appointment?.status);

  if (status === "SCHEDULED") {
    return {
      reason: "Agendamento sem confirmação aumenta risco de no-show.",
      conditions: ["Status: agendado", "Confirmação do cliente pendente"],
      afterAction: "Depois da confirmação, avance para execução da O.S.",
    };
  }
  if (status === "DONE") {
    return {
      reason: "Atendimento concluído precisa fechar ciclo operacional.",
      conditions: ["Status: concluído", "Validar O.S. e financeiro"],
      afterAction: "Após validar, gerar/acompanhar cobrança e enviar WhatsApp.",
    };
  }
  return {
    reason: "Agendamento em fluxo normal.",
    conditions: [`Status atual: ${status || "não informado"}`],
    afterAction: "Mantenha o próximo passo operacional em evidência.",
  };
}

export function getCustomerExplainLayer(workspace: any): ExplainLayerContent {
  const overdue = workspace?.charges?.filter((c: any) => normalizeStatus(c.status) === "OVERDUE").length ?? 0;
  const pending = workspace?.charges?.filter((c: any) => normalizeStatus(c.status) === "PENDING").length ?? 0;

  if (overdue > 0) {
    return {
      reason: "Cliente tem cobrança vencida e precisa de recuperação ativa.",
      conditions: [`Cobranças vencidas: ${overdue}`, "Impacto direto em caixa"],
      afterAction: "Após contato, registre retorno e próximo compromisso financeiro.",
    };
  }
  if (pending > 0) {
    return {
      reason: "Existe cobrança pendente sem fechamento financeiro.",
      conditions: [`Cobranças pendentes: ${pending}`, "Follow-up necessário"],
      afterAction: "Depois do lembrete, acompanhe até pagamento confirmado.",
    };
  }
  return {
    reason: "Cliente em estado operacional saudável.",
    conditions: ["Sem cobrança crítica no momento"],
    afterAction: "Mantenha frequência de contato e próxima ação agendada.",
  };
}
