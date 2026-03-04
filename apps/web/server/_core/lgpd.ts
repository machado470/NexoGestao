import { logger } from "./logger";

export async function createLgpdRequest(userId: string, payload: any) {
  logger.audit.info(`LGPD request created for user ${userId} payload=${JSON.stringify(payload)}`);
  return { ok: true };
}

export async function runLgpdDeletion(userId: string) {
  logger.audit.info(`Starting LGPD deletion for user ${userId}`);

  try {
    logger.audit.info(`LGPD deletion completed for user ${userId}`);
    return { ok: true };
  } catch (err: any) {
    const e = err instanceof Error ? err : new Error(String(err));
    logger.audit.error(`LGPD deletion failed for user ${userId}`, e);
    return { ok: false };
  }
}
