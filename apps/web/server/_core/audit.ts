import type { Context } from "./context";

export type AuditAction =
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "EXPORT"
  | "IMPORT"
  | "PERMISSION_CHANGE"
  | "SETTINGS_CHANGE";

export type AuditEntity =
  | "CUSTOMER"
  | "APPOINTMENT"
  | "SERVICE_ORDER"
  | "PERSON"
  | "FINANCE"
  | "GOVERNANCE"
  | "USER"
  | "ORGANIZATION"
  | "INVOICE"
  | "EXPENSE"
  | "LAUNCH"
  | "REFERRAL";

export interface AuditLog {
  id?: string;
  timestamp: Date;
  userId: number | undefined;
  organizationId: number | undefined;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string | number;
  entityName?: string;
  changes?: Record<string, { before: any; after: any }>;
  ip?: string;
  userAgent?: string;
  status: "SUCCESS" | "FAILURE";
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Armazena logs de auditoria em memória (para produção, usar banco de dados)
 */
const auditLogs: AuditLog[] = [];

/**
 * Registra uma ação de auditoria
 */
export async function recordAudit(
  ctx: Context,
  action: AuditAction,
  entity: AuditEntity,
  entityId: string | number,
  options?: {
    entityName?: string;
    changes?: Record<string, { before: any; after: any }>;
    status?: "SUCCESS" | "FAILURE";
    errorMessage?: string;
    metadata?: Record<string, any>;
  }
): Promise<AuditLog> {
  const log: AuditLog = {
    timestamp: new Date(),
    userId: ctx.user?.id,
    organizationId: ctx.user?.organizationId,
    action,
    entity,
    entityId,
    entityName: options?.entityName,
    changes: options?.changes,
    ip: ctx.req?.headers["x-forwarded-for"] as string | undefined,
    userAgent: ctx.req?.headers["user-agent"] as string | undefined,
    status: options?.status || "SUCCESS",
    errorMessage: options?.errorMessage,
    metadata: options?.metadata,
  };

  // Salvar em banco de dados (Drizzle ORM)
  try {
    // TODO: Implementar quando Drizzle estiver configurado
    // await db.insert(auditLogsTable).values(log);
  } catch (error) {
    console.error('Erro ao salvar log de auditoria:', error);
  }
  
  // Fallback: armazenar em memória
  auditLogs.push(log);

  // Manter apenas últimos 10000 logs em memória
  if (auditLogs.length > 10000) {
    auditLogs.shift();
  }

  console.log(
    `[AUDIT] ${log.action} ${log.entity} #${log.entityId} by user ${log.userId} from ${log.ip}`
  );

  return log;
}

/**
 * Obtém logs de auditoria com filtros
 */
export async function getAuditLogs(filters: {
  organizationId?: number;
  userId?: number;
  entity?: AuditEntity;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<AuditLog[]> {
  let results = [...auditLogs];

  if (filters.organizationId) {
    results = results.filter((log) => log.organizationId === filters.organizationId);
  }

  if (filters.userId) {
    results = results.filter((log) => log.userId === filters.userId);
  }

  if (filters.entity) {
    results = results.filter((log) => log.entity === filters.entity);
  }

  if (filters.action) {
    results = results.filter((log) => log.action === filters.action);
  }

  if (filters.startDate) {
    results = results.filter((log) => log.timestamp >= filters.startDate!);
  }

  if (filters.endDate) {
    results = results.filter((log) => log.timestamp <= filters.endDate!);
  }

  // Ordena por timestamp descendente
  results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Aplica paginação
  const offset = filters.offset || 0;
  const limit = filters.limit || 100;

  return results.slice(offset, offset + limit);
}

/**
 * Obtém estatísticas de auditoria
 */
export async function getAuditStats(organizationId: number): Promise<{
  totalActions: number;
  actionsByType: Record<AuditAction, number>;
  entitiesByType: Record<AuditEntity, number>;
  failureRate: number;
  topUsers: Array<{ userId: number; count: number }>;
}> {
  const orgLogs = auditLogs.filter((log) => log.organizationId === organizationId);

  const actionsByType: Record<AuditAction, number> = {} as any;
  const entitiesByType: Record<AuditEntity, number> = {} as any;
  const userCounts: Record<number, number> = {};
  let failures = 0;

  for (const log of orgLogs) {
    actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
    entitiesByType[log.entity] = (entitiesByType[log.entity] || 0) + 1;

    if (log.userId) {
      userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;
    }

    if (log.status === "FAILURE") {
      failures++;
    }
  }

  const topUsers = Object.entries(userCounts)
    .map(([userId, count]) => ({ userId: parseInt(userId), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalActions: orgLogs.length,
    actionsByType,
    entitiesByType,
    failureRate: orgLogs.length > 0 ? failures / orgLogs.length : 0,
    topUsers,
  };
}

/**
 * Limpa logs antigos (retenção de 90 dias por padrão)
 */
export async function cleanupOldLogs(retentionDays: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const initialLength = auditLogs.length;
  const filtered = auditLogs.filter((log) => log.timestamp > cutoffDate);

  // Atualiza array
  auditLogs.length = 0;
  auditLogs.push(...filtered);

  const deleted = initialLength - auditLogs.length;
  console.log(`[AUDIT] Deleted ${deleted} logs older than ${retentionDays} days`);

  return deleted;
}

/**
 * Detecta atividades suspeitas
 */
export async function detectSuspiciousActivity(organizationId: number): Promise<
  Array<{
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    description: string;
    logs: AuditLog[];
  }>
> {
  const orgLogs = auditLogs.filter((log) => log.organizationId === organizationId);
  const alerts: Array<{
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    description: string;
    logs: AuditLog[];
  }> = [];

  // Detecta múltiplas falhas de login
  const loginFailures = orgLogs.filter(
    (log) => log.action === "LOGIN" && log.status === "FAILURE"
  );
  if (loginFailures.length > 5) {
    const lastHour = loginFailures.filter(
      (log) => log.timestamp.getTime() > Date.now() - 3600000
    );
    if (lastHour.length > 3) {
      alerts.push({
        type: "BRUTE_FORCE_ATTEMPT",
        severity: "HIGH",
        description: `${lastHour.length} tentativas de login falhadas na última hora`,
        logs: lastHour,
      });
    }
  }

  // Detecta exclusões em massa
  const deletions = orgLogs.filter((log) => log.action === "DELETE");
  const lastHourDeletions = deletions.filter(
    (log) => log.timestamp.getTime() > Date.now() - 3600000
  );
  if (lastHourDeletions.length > 10) {
    alerts.push({
      type: "MASS_DELETION",
      severity: "HIGH",
      description: `${lastHourDeletions.length} exclusões na última hora`,
      logs: lastHourDeletions,
    });
  }

  // Detecta alterações de permissões
  const permChanges = orgLogs.filter((log) => log.action === "PERMISSION_CHANGE");
  const lastDayPermChanges = permChanges.filter(
    (log) => log.timestamp.getTime() > Date.now() - 86400000
  );
  if (lastDayPermChanges.length > 5) {
    alerts.push({
      type: "PERMISSION_CHANGES",
      severity: "MEDIUM",
      description: `${lastDayPermChanges.length} alterações de permissão no último dia`,
      logs: lastDayPermChanges,
    });
  }

  return alerts;
}
