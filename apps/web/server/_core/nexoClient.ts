import cookie from "cookie";

const NEXO_API_URL = process.env.NEXO_API_URL || "http://127.0.0.1:3001";
const NEXO_TOKEN_COOKIE = "nexo_token";

function getNexoTokenFromReq(req: any): string | null {
  const raw = req?.headers?.cookie;
  if (!raw || typeof raw !== "string") return null;

  const parsed = cookie.parse(raw);
  const token = parsed?.[NEXO_TOKEN_COOKIE];
  return typeof token === "string" && token.trim().length > 0 ? token : null;
}

function extractErrorMessage(body: any, status: number): string {
  if (!body) return `Nexo API error ${status}`;

  if (typeof body === "string" && body.trim()) {
    return body;
  }

  if (Array.isArray(body?.message)) {
    return body.message.join(", ");
  }

  if (typeof body?.message === "string" && body.message.trim()) {
    return body.message;
  }

  if (typeof body?.error === "string" && body.error.trim()) {
    return body.error;
  }

  if (typeof body?.data?.message === "string" && body.data.message.trim()) {
    return body.data.message;
  }

  return `Nexo API error ${status}`;
}

export class NexoHttpError extends Error {
  status: number;
  body: any;

  constructor(status: number, body: any) {
    super(extractErrorMessage(body, status));
    this.name = "NexoHttpError";
    this.status = status;
    this.body = body;
  }
}

export async function nexoFetch<T>(
  req: any,
  path: string,
  init?: RequestInit & { allowAnonymous?: boolean }
): Promise<T | null> {
  const token = getNexoTokenFromReq(req);

  if (!token) {
    if (init?.allowAnonymous) return null;
    throw new NexoHttpError(401, { message: "Não autenticado" });
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
