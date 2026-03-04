/**
 * Helpers para soft delete
 * Marca registros como deletados sem remover do banco
 */

import { db } from "../db";

export async function softDelete(
  table: string,
  id: number,
  userId: number,
  organizationId: number
) {
  const now = new Date();

  // Atualizar registro com deletedAt
  await db.execute(
    `UPDATE ${table} SET deletedAt = ? WHERE id = ? AND organizationId = ?`,
    [now, id, organizationId]
  );

  // Registrar na auditoria
  await recordAudit({
    entityType: table,
    entityId: id,
    action: "DELETE",
    userId,
    organizationId,
    changes: { deletedAt: now },
  });
}

export async function softDeleteMany(
  table: string,
  ids: number[],
  userId: number,
  organizationId: number
) {
  const now = new Date();

  // Atualizar múltiplos registros
  await db.execute(
    `UPDATE ${table} SET deletedAt = ? WHERE id IN (${ids
      .map(() => "?")
      .join(",")}) AND organizationId = ?`,
    [now, ...ids, organizationId]
  );

  // Registrar cada deletação na auditoria
  for (const id of ids) {
    await recordAudit({
      entityType: table,
      entityId: id,
      action: "DELETE",
      userId,
      organizationId,
      changes: { deletedAt: now },
    });
  }
}

export async function restore(
  table: string,
  id: number,
  userId: number,
  organizationId: number
) {
  // Remover deletedAt
  await db.execute(
    `UPDATE ${table} SET deletedAt = NULL WHERE id = ? AND organizationId = ?`,
    [id, organizationId]
  );

  // Registrar na auditoria
  await recordAudit({
    entityType: table,
    entityId: id,
    action: "RESTORE",
    userId,
    organizationId,
    changes: { deletedAt: null },
  });
}

export async function permanentlyDelete(
  table: string,
  id: number,
  userId: number,
  organizationId: number
) {
  // Registrar na auditoria antes de deletar
  await recordAudit({
    entityType: table,
    entityId: id,
    action: "PERMANENT_DELETE",
    userId,
    organizationId,
  });

  // Deletar permanentemente
  await db.execute(
    `DELETE FROM ${table} WHERE id = ? AND organizationId = ?`,
    [id, organizationId]
  );
}

/**
 * Registra alterações na auditoria
 */
export async function recordAudit(data: {
  entityType: string;
  entityId: number;
  action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "PERMANENT_DELETE";
  userId: number;
  organizationId: number;
  changes?: Record<string, any>;
}) {
  await db.execute(
    `INSERT INTO auditLogs (entityType, entityId, action, userId, changes, organizationId) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.entityType,
      data.entityId,
      data.action,
      data.userId,
      JSON.stringify(data.changes || {}),
      data.organizationId,
    ]
  );
}

/**
 * Obtém histórico de alterações de um registro
 */
export async function getAuditHistory(
  entityType: string,
  entityId: number,
  organizationId: number
) {
  const logs = await db.query(
    `SELECT * FROM auditLogs 
     WHERE entityType = ? AND entityId = ? AND organizationId = ?
     ORDER BY createdAt DESC`,
    [entityType, entityId, organizationId]
  );

  return logs.map((log: any) => ({
    ...log,
    changes: JSON.parse(log.changes || "{}"),
  }));
}

/**
 * Query helper para excluir registros deletados por padrão
 */
export function excludeDeleted(query: any) {
  return query.where({ deletedAt: null });
}

/**
 * Query helper para incluir apenas registros deletados
 */
export function onlyDeleted(query: any) {
  return query.where({ deletedAt: { not: null } });
}

/**
 * Query helper para incluir registros deletados
 */
export function includeDeleted(query: any) {
  return query; // Sem filtro de deletedAt
}
