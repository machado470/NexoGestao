// apps/web/server/_core/nexoClient.ts
import cookie from "cookie";

const NEXO_API_URL = process.env.NEXO_API_URL || "http://localhost:3000";
const NEXO_TOKEN_COOKIE = "nexo_token";

function getNexoTokenFromReq(req: any): string | null {
  const raw = req?.headers?.cookie;
  if (!raw || typeof raw !== "string") return null;

  const parsed = cookie.parse(raw);
  const token = parsed?.[NEXO_TOKEN_COOKIE];
  return token || null;
}

export class NexoHttpError extends Error {
  status: number;
  body: any;

  constructor(status: number, body: any) {
    super(`Nexo API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

/**
 * Faz fetch pro Nest com Bearer token vindo do cookie httpOnly (nexo_token).
 * - Se não tiver token, retorna null (pra rotas que aceitam anon).
 * - Se tiver token mas API falhar, lança NexoHttpError.
 */
export async function nexoFetch<T>(
  req: any,
  path: string,
  init?: RequestInit & { allowAnonymous?: boolean }
): Promise<T | null> {
  const token = getNexoTokenFromReq(req);

  if (!token) {
    if (init?.allowAnonymous) return null;
    // Sem token = sem sessão
    return null;
  }

  const res = await fetch(`${NEXO_API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });

  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    throw new NexoHttpError(res.status, body);
  }

  return body as T;
}
