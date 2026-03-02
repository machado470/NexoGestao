/**
 * Helpers para LGPD - Direito ao esquecimento
 * Permite que usuários solicitem exclusão de seus dados
 */

import { db } from '@/server/db';
import { logger } from './logger';

export interface LGPDRequest {
  userId: number;
  organizationId: number;
  reason?: string;
  requestedAt: Date;
  completedAt?: Date;
}

/**
 * Cria uma solicitação de exclusão de dados (direito ao esquecimento)
 */
export async function createLGPDRequest(
  userId: number,
  organizationId: number,
  reason?: string
): Promise<LGPDRequest> {
  const request: LGPDRequest = {
    userId,
    organizationId,
    reason,
    requestedAt: new Date(),
  };

  // Armazenar solicitação
  await db.execute(
    `INSERT INTO lgpdRequests (userId, organizationId, reason, requestedAt) 
     VALUES (?, ?, ?, ?)`,
    [userId, organizationId, reason, request.requestedAt]
  );

  logger.audit(`LGPD request created for user ${userId}`, {
    userId,
    organizationId,
    reason,
  });

  return request;
}

/**
 * Executa a exclusão de dados de um usuário (LGPD)
 * Remove todos os dados pessoais do usuário
 */
export async function executeLGPDDeletion(
  userId: number,
  organizationId: number
): Promise<void> {
  const startTime = Date.now();

  try {
    logger.audit(`Starting LGPD deletion for user ${userId}`, {
      userId,
      organizationId,
    });

    // 1. Deletar dados pessoais do usuário
    await db.execute(
      `UPDATE users SET 
       name = 'Usuário Deletado',
       email = CONCAT('deleted_', id, '_', ?),
       phone = NULL,
       cpf = NULL,
       avatar = NULL
       WHERE id = ? AND organizationId = ?`,
      [Date.now(), userId, organizationId]
    );

    // 2. Anonimizar clientes criados pelo usuário
    await db.execute(
      `UPDATE customers SET 
       name = 'Cliente Deletado',
       email = NULL,
       phone = NULL,
       cpf = NULL,
       cnpj = NULL,
       address = NULL,
       city = NULL,
       state = NULL,
       zipCode = NULL
       WHERE createdBy = ? AND organizationId = ?`,
      [userId, organizationId]
    );

    // 3. Remover notas privadas
    await db.execute(
      `DELETE FROM notes WHERE userId = ? AND organizationId = ?`,
      [userId, organizationId]
    );

    // 4. Anonimizar agendamentos
    await db.execute(
      `UPDATE appointments SET 
       notes = NULL,
       observations = NULL
       WHERE createdBy = ? AND organizationId = ?`,
      [userId, organizationId]
    );

    // 5. Anonimizar ordens de serviço
    await db.execute(
      `UPDATE serviceOrders SET 
       description = NULL,
       notes = NULL
       WHERE createdBy = ? AND organizationId = ?`,
      [userId, organizationId]
    );

    // 6. Remover histórico de login
    await db.execute(
      `DELETE FROM loginHistory WHERE userId = ? AND organizationId = ?`,
      [userId, organizationId]
    );

    // 7. Remover tokens de autenticação
    await db.execute(
      `DELETE FROM authTokens WHERE userId = ? AND organizationId = ?`,
      [userId, organizationId]
    );

    // 8. Marcar LGPD como completado
    await db.execute(
      `UPDATE lgpdRequests SET completedAt = ? 
       WHERE userId = ? AND organizationId = ?`,
      [new Date(), userId, organizationId]
    );

    const duration = Date.now() - startTime;
    logger.audit(`LGPD deletion completed for user ${userId}`, {
      userId,
      organizationId,
      duration,
    });
  } catch (error) {
    logger.error(`LGPD deletion failed for user ${userId}`, {
      userId,
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * Obtém histórico de solicitações LGPD de uma organização
 */
export async function getLGPDRequests(
  organizationId: number,
  status?: 'pending' | 'completed'
) {
  let query = `SELECT * FROM lgpdRequests WHERE organizationId = ?`;
  const params: any[] = [organizationId];

  if (status === 'pending') {
    query += ` AND completedAt IS NULL`;
  } else if (status === 'completed') {
    query += ` AND completedAt IS NOT NULL`;
  }

  query += ` ORDER BY requestedAt DESC`;

  return db.query(query, params);
}

/**
 * Cria tabela de solicitações LGPD
 */
export async function createLGPDTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS lgpdRequests (
      id INT PRIMARY KEY AUTO_INCREMENT,
      userId INT NOT NULL,
      organizationId INT NOT NULL,
      reason VARCHAR(500),
      requestedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completedAt TIMESTAMP NULL,
      
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (organizationId) REFERENCES organizations(id),
      INDEX idx_lgpdRequests_org (organizationId),
      INDEX idx_lgpdRequests_user (userId),
      INDEX idx_lgpdRequests_status (completedAt)
    )
  `);
}

/**
 * Cria tabela de consentimento de dados
 */
export async function createConsentTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dataConsents (
      id INT PRIMARY KEY AUTO_INCREMENT,
      userId INT NOT NULL,
      organizationId INT NOT NULL,
      type VARCHAR(50) NOT NULL,
      consentedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      revokedAt TIMESTAMP NULL,
      ipAddress VARCHAR(45),
      userAgent VARCHAR(500),
      
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (organizationId) REFERENCES organizations(id),
      INDEX idx_dataConsents_user (userId),
      INDEX idx_dataConsents_org (organizationId),
      INDEX idx_dataConsents_type (type)
    )
  `);
}

/**
 * Registra consentimento de dados
 */
export async function recordConsent(
  userId: number,
  organizationId: number,
  type: 'marketing' | 'analytics' | 'cookies' | 'terms',
  ipAddress?: string,
  userAgent?: string
) {
  await db.execute(
    `INSERT INTO dataConsents (userId, organizationId, type, ipAddress, userAgent) 
     VALUES (?, ?, ?, ?, ?)`,
    [userId, organizationId, type, ipAddress, userAgent]
  );
}

/**
 * Revoga consentimento de dados
 */
export async function revokeConsent(
  userId: number,
  organizationId: number,
  type: string
) {
  await db.execute(
    `UPDATE dataConsents SET revokedAt = ? 
     WHERE userId = ? AND organizationId = ? AND type = ? AND revokedAt IS NULL`,
    [new Date(), userId, organizationId, type]
  );
}

/**
 * Obtém consentimentos ativos de um usuário
 */
export async function getActiveConsents(
  userId: number,
  organizationId: number
) {
  return db.query(
    `SELECT * FROM dataConsents 
     WHERE userId = ? AND organizationId = ? AND revokedAt IS NULL`,
    [userId, organizationId]
  );
}
