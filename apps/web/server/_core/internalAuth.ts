import { createHash, createHmac, randomBytes } from "node:crypto";

/**
 * C7.2d — BFF → API internal authentication, protocol v1 (signer side).
 *
 * Proves to the API that a request was produced by this BFF. It does NOT carry or prove the end
 * user's identity (that is the JWT) nor the end user's IP (still unverified, NO_TRUST).
 * Same canonicalization as apps/api/src/common/internal-auth/internal-auth.protocol.ts; both
 * suites check the same known-answer vector.
 *
 * Header: X-Nexo-Internal-Auth: v1.<kid>.<ts>.<nonce>.<sig>
 * Canonical: NEXO-INTERNAL-AUTH\nv1\n<kid>\n<ts>\n<nonce>\n<METHOD>\n<request-target>\n<sha256(body) hex>
 */
export const INTERNAL_AUTH_HEADER = "x-nexo-internal-auth";
const KID = /^[A-Za-z0-9_-]{1,32}$/;
const MIN_KEY_BYTES = 32;

export type InternalAuthSigner = { kid: string; key: Buffer };

/** Strict base64/base64url decoding (round-trip check). */
function decodeKey(raw: string): Buffer | null {
  const value = raw.trim();
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) return null;
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const decoded = Buffer.from(normalized, "base64");
  if (decoded.toString("base64").replace(/=+$/, "") !== normalized) return null;
  return decoded;
}

/**
 * NEXO_INTERNAL_AUTH_SIGNING: "true" enables signing; unset/"false" (default) disables it.
 * When enabled, NEXO_INTERNAL_AUTH_KEY_ID and NEXO_INTERNAL_AUTH_SECRET (base64, >= 32 bytes)
 * are required; invalid values fail the boot. Messages never include key material.
 */
export function readInternalAuthSigner(env: NodeJS.ProcessEnv = process.env): InternalAuthSigner | null {
  const flag = (env.NEXO_INTERNAL_AUTH_SIGNING ?? "").trim().toLowerCase();
  if (!flag || flag === "false") return null;
  if (flag !== "true") throw new Error('NEXO_INTERNAL_AUTH_SIGNING must be "true" or "false"');
  const kid = (env.NEXO_INTERNAL_AUTH_KEY_ID ?? "").trim();
  if (!KID.test(kid)) throw new Error("NEXO_INTERNAL_AUTH_KEY_ID is missing or invalid");
  const key = decodeKey(env.NEXO_INTERNAL_AUTH_SECRET ?? "");
  if (!key || key.length < MIN_KEY_BYTES) throw new Error(`NEXO_INTERNAL_AUTH_SECRET must be base64 with at least ${MIN_KEY_BYTES} bytes`);
  return { kid, key };
}

let cachedSigner: InternalAuthSigner | null | undefined;

/** Signer for this process, read once. Throws on invalid configuration (called at boot). */
export function internalAuthSigner(): InternalAuthSigner | null {
  if (cachedSigner === undefined) cachedSigner = readInternalAuthSigner();
  return cachedSigner;
}

/** Test hook: forget the cached configuration. */
export function resetInternalAuthSignerForTests() {
  cachedSigner = undefined;
}

/** Path + query exactly as fetch sends it (keeps an empty "?", drops the fragment). */
export function requestTarget(url: string | URL): string {
  const parsed = new URL(String(url));
  return parsed.href.slice(parsed.origin.length).replace(/#.*$/, "");
}

export function canonicalString(input: { kid: string; ts: number; nonce: string; method: string; target: string; bodySha256: string }): string {
  return ["NEXO-INTERNAL-AUTH", "v1", input.kid, String(input.ts), input.nonce, input.method.toUpperCase(), input.target, input.bodySha256].join("\n");
}

export function signInternalRequest(
  signer: InternalAuthSigner,
  input: { method?: string; url: string | URL; body?: unknown },
  now: () => number = Date.now,
  nonce: string = randomBytes(16).toString("base64url"),
): string | null {
  // Only string (JSON) bodies or no body are signed; anything else is left unsigned on purpose.
  if (input.body !== undefined && input.body !== null && typeof input.body !== "string") return null;
  const ts = Math.floor(now() / 1000);
  const bodySha256 = createHash("sha256").update((input.body as string | null | undefined) ?? "").digest("hex");
  const canonical = canonicalString({ kid: signer.kid, ts, nonce, method: input.method ?? "GET", target: requestTarget(input.url), bodySha256 });
  const sig = createHmac("sha256", signer.key).update(canonical).digest("base64url");
  return `v1.${signer.kid}.${ts}.${nonce}.${sig}`;
}

/** Removes every x-nexo-* header (client-supplied values must never reach the API). */
export function withoutInternalHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!/^x-nexo-/i.test(name)) result[name] = value;
  }
  return result;
}

/**
 * Final headers for an outgoing BFF → API call: caller headers without any x-nexo-* entry, plus
 * this BFF's own signature (written last) when signing is enabled. Signing failures never block
 * the call: the request simply goes out unsigned, as before C7.2d.
 */
export function internalApiHeaders(
  headers: HeadersInit | undefined,
  request: { method?: string; url: string | URL; body?: unknown },
  signer: InternalAuthSigner | null = internalAuthSigner(),
): Record<string, string> {
  // Keep the caller's header names as written (plain objects are the norm in this BFF).
  const plain: Record<string, string> =
    headers instanceof Headers ? (() => { const entries: Record<string, string> = {}; headers.forEach((value, name) => { entries[name] = value; }); return entries; })()
      : Array.isArray(headers) ? Object.fromEntries(headers)
        : { ...((headers as Record<string, string> | undefined) ?? {}) };
  const cleaned = withoutInternalHeaders(plain);
  if (!signer) return cleaned;
  try {
    const value = signInternalRequest(signer, request);
    if (value) cleaned[INTERNAL_AUTH_HEADER] = value;
  } catch {
    // never block the request
  }
  return cleaned;
}

/** Express middleware: drop client-supplied x-nexo-* headers at the BFF entrance. */
export function stripClientInternalHeaders(req: { headers: Record<string, unknown> }, _res: unknown, next: () => void) {
  try {
    for (const name of Object.keys(req.headers ?? {})) {
      if (/^x-nexo-/i.test(name)) delete req.headers[name];
    }
  } catch {
    // never block the request
  }
  next();
}
