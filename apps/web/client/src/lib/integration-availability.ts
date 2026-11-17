export function whatsappAvailability(health?: { status: string; queueAvailable: boolean } | null) {
  if (!health) return { canSend: false, label: "Disponibilidade não confirmada", reason: "Não foi possível confirmar o canal. Verifique novamente antes de enviar." };
  if (health.status === "disabled") return { canSend: false, label: "WhatsApp desativado", reason: "O envio de WhatsApp está desativado neste ambiente. O histórico continua disponível." };
  if (health.status === "misconfigured") return { canSend: false, label: "WhatsApp não configurado", reason: "O canal precisa ser configurado antes de enviar mensagens." };
  if (!health.queueAvailable) return { canSend: false, label: "Envio temporariamente indisponível", reason: "O processamento de mensagens está indisponível. Tente verificar novamente." };
  if (health.status === "configured_mock") return { canSend: true, label: "WhatsApp em demonstração", reason: "Modo de demonstração: as mensagens não são entregues a números reais." };
  if (health.status === "configured") return { canSend: true, label: "Canal disponível", reason: "" };
  return { canSend: false, label: "Estado do canal desconhecido", reason: "Verifique a configuração do canal antes de enviar." };
}

export function requiresWhatsAppChannel(action: string | null | undefined) {
  return ["SEND_PAYMENT_LINK", "CONFIRM_APPOINTMENT", "RESCHEDULE_APPOINTMENT", "SEND_SERVICE_UPDATE", "REPLY_WITH_TEMPLATE"].includes(action ?? "");
}
