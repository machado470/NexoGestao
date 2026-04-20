const ACTION_KEYWORDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /cobrar|cobrança/i, label: "Cobrar" },
  { pattern: /confirmar|confirmação/i, label: "Confirmar" },
  { pattern: /reengajar|reativar/i, label: "Reengajar" },
  { pattern: /criar\s*o\.?s\.?|ordem de serviço|o\.?s\./i, label: "Criar O.S." },
  { pattern: /agenda|agendamento/i, label: "Criar agenda" },
  { pattern: /iniciar/i, label: "Iniciar" },
  { pattern: /notificar|avisar/i, label: "Notificar" },
  { pattern: /atribuir/i, label: "Atribuir" },
  { pattern: /acompanhar/i, label: "Acompanhar" },
  { pattern: /contatar|whatsapp/i, label: "Contatar" },
  { pattern: /abrir|detalhe/i, label: "Abrir" },
];

export function resolveOperationalActionLabel(
  text: string,
  fallback = "Abrir"
) {
  const normalized = String(text ?? "").trim();
  if (!normalized) return fallback;

  for (const keyword of ACTION_KEYWORDS) {
    if (keyword.pattern.test(normalized)) {
      return keyword.label;
    }
  }

  return fallback;
}

export function toSingleLineAction(text: string, maxLength = 52) {
  const normalized = String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+[—-]\s+.*/g, "")
    .replace(/\s*[·|]\s*.*/g, "")
    .trim();

  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}
