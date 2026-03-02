/**
 * Adaptador para converter NestJS Services em tRPC-compatible
 * Remove dependências de NestJS e integra com Prisma
 */

import prisma from "./prisma";

/**
 * Classe base para adaptar services NestJS
 */
export class ServiceAdapter {
  protected prisma = prisma;

  /**
   * Remove decoradores e injeções de dependência
   */
  static adaptService(ServiceClass: any) {
    return new ServiceClass(prisma);
  }
}

/**
 * Helper para criar routers tRPC a partir de services
 */
export function createServiceRouter<T extends Record<string, any>>(
  service: T,
  procedures: Record<string, { input?: any; handler: (input?: any) => Promise<any> }>
) {
  return Object.entries(procedures).reduce(
    (acc, [name, { input, handler }]) => {
      acc[name] = { input, handler: () => handler(input) };
      return acc;
    },
    {} as Record<string, any>
  );
}

/**
 * Tipos para services adaptados
 */
export interface AdaptedService {
  [key: string]: (...args: any[]) => Promise<any>;
}
