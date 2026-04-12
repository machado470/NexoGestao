export function reasonCodeToHuman(reasonCode?: string | null) {
  if (!reasonCode) return "Bloqueada por regra operacional";
  if (reasonCode === "blocked_recent_execution") return "Executada recentemente";
  if (reasonCode === "mode_manual_explicit_configuration") return "Modo manual ativo";
  if (reasonCode === "limit_exceeded") return "Limite da engine atingido";
  if (reasonCode === "feature_not_in_plan") return "Recurso indisponível no plano";
  if (reasonCode === "auth_invalid_session") return "Sessão inválida para execução automática";
  if (reasonCode === "already_paid") return "Cobrança já paga";
  if (reasonCode === "charge_followup_already_exists") return "Follow-up já existe";
  return "Bloqueada por regra operacional";
}

export function formatRemainingCooldown(cooldownUntil?: string | null, nowMs = Date.now()) {
  if (!cooldownUntil) return null;
  const target = new Date(cooldownUntil);
  if (Number.isNaN(target.getTime())) return null;

  const diffMs = target.getTime() - nowMs;
  if (diffMs <= 0) return null;

  const seconds = Math.ceil(diffMs / 1000);
  if (seconds < 60) return `Disponível em ${seconds} s`;

  const minutes = Math.ceil(seconds / 60);
  return `Disponível em ${minutes} min`;
}

export function executionStatusLabel(status?: string, reasonCode?: string | null) {
  if (status === "failed") return "Falha";
  if (reasonCode === "blocked_recent_execution") return "Protegida por cooldown";
  if (reasonCode === "mode_manual_explicit_configuration") return "Bloqueada por modo manual";
  if (status === "executed") return "Executada";
  if (status === "blocked" || status === "requires_confirmation" || status === "throttled") return "Bloqueada";
  if (status === "skipped") return "Ignorada neste ciclo";
  return "Pendente";
}
