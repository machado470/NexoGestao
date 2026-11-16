import { nexoFetch } from "./nexoClient";
import { unwrapNexoApiResponse } from "./nexoEnvelope";

export type NexoContext = {
  req?: any;
  user?: { token?: string } | null;
};

export function toQueryString(input?: Record<string, unknown> | null): string {
  if (!input || typeof input !== "object") return "";

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "" || Number.isNaN(value)) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) params.append(key, String(item));
      }
      continue;
    }
    params.append(key, String(value));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function authedFetch(
  ctx: NexoContext,
  path: string,
  options: RequestInit = {},
) {
  const raw = await nexoFetch<unknown>(ctx, path, options);
  return unwrapNexoApiResponse<any>(raw);
}

export function authedGet(
  ctx: NexoContext,
  path: string,
  query?: Record<string, unknown> | null,
) {
  return authedFetch(ctx, `${path}${toQueryString(query)}`);
}

export function authedPost(
  ctx: NexoContext,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) {
  return authedFetch(ctx, path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers,
  });
}

export function authedPatch(ctx: NexoContext, path: string, body?: unknown) {
  return authedFetch(ctx, path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Additive paginated transport: retain metadata discarded by legacy array readers. */
export async function authedGetPage(ctx: NexoContext, path: string, query?: Record<string, unknown> | null): Promise<{ items: unknown[]; meta: { page: number; limit: number; total: number; pages: number } }> {
  let raw: any = await nexoFetch<unknown>(ctx, `${path}${toQueryString(query)}`);
  for (let i = 0; i < 6 && raw; i++) {
    if (raw.success === false || raw.ok === false) { unwrapNexoApiResponse(raw); throw new Error("Resposta de erro da API"); }
    if (Array.isArray(raw.data) || !raw.data || typeof raw.data !== "object") break;
    raw = raw.data;
  }
  const meta = raw?.meta ?? raw?.pagination;
  if (!Array.isArray(raw?.data) || !meta || !Number.isFinite(meta.total)) throw new Error("Resposta paginada sem metadados válidos");
  return { items: raw.data as unknown[], meta: { page: Number(meta.page), limit: Number(meta.limit), total: Number(meta.total), pages: Number(meta.pages) } };
}
