// apps/web/server/db.ts
/**
 * DB local (drizzle/mysql) foi removido.
 * O portal agora fala com o backend Nest (NexoGestão) via proxy + cookie "nexo_token".
 *
 * Este arquivo existe só para:
 *  - evitar crash no boot por imports antigos
 *  - facilitar a migração incremental dos routers/_core que ainda referenciam "../db"
 */

export async function getDb() {
  return null;
}

export const db: any = null;

export default db;

/**
 * Se algum router ainda tentar usar funções antigas do DB, a gente joga erro explícito.
 */
function removed(name: string): never {
  throw new Error(`[Portal] Função removida (${name}). Migre para proxy do Nest (nexoFetch).`);
}

// Legacy placeholders (pra falhar de forma clara)
export const createCustomer = () => removed("createCustomer");
export const getCustomersByOrg = () => removed("getCustomersByOrg");
export const getCustomerById = () => removed("getCustomerById");
export const updateCustomer = () => removed("updateCustomer");
export const deleteCustomer = () => removed("deleteCustomer");

export const createAppointment = () => removed("createAppointment");
export const getAppointmentsByOrg = () => removed("getAppointmentsByOrg");
export const getAppointmentById = () => removed("getAppointmentById");
export const updateAppointment = () => removed("updateAppointment");
export const deleteAppointment = () => removed("deleteAppointment");

export const createServiceOrder = () => removed("createServiceOrder");
export const getServiceOrdersByOrg = () => removed("getServiceOrdersByOrg");
export const getServiceOrderById = () => removed("getServiceOrderById");
export const updateServiceOrder = () => removed("updateServiceOrder");
export const deleteServiceOrder = () => removed("deleteServiceOrder");
