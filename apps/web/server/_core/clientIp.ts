import { BlockList, isIP } from "node:net";
import type { IncomingMessage } from "node:http";

/**
 * C7.2c — observation of the client IP chain (BFF side).
 *
 * Nothing here is used for rate limiting, authentication or authorization. The BFF does not
 * know yet how Railway's edge builds X-Forwarded-For (overwrite or append, how many hops), so
 * headers are never trusted by default: with the production policy (`NO_TRUST`) no request is
 * ever classified as "verified". The goal is to measure the real topology (aggregated,
 * bounded counters; no IPs, hashes, tokens or cookies) before C7.2d/C7.2e rely on it.
 *
 * Classification:
 *  - verified:   the TCP peer is an explicitly trusted proxy and the chain has the expected
 *                number of trusted hops; the candidate is taken counting from the right.
 *  - unverified: well-formed headers (or none) but no trusted proxy configuration applies.
 *  - invalid:    malformed, oversized, repeated or contradictory forwarding headers.
 */

export type IpFamily = "ipv4" | "ipv6" | "unknown";
export type IpScope = "loopback" | "private" | "link-local" | "public" | "unknown";
export type Classification = "verified" | "unverified" | "invalid";
export type CandidateSource = "forwarded-for" | "real-ip" | "connection" | "none";

export type ChainIssue =
  | "xff_malformed_entry"
  | "xff_too_many_hops"
  | "xff_too_long"
  | "xff_repeated_header"
  | "xri_malformed"
  | "xri_repeated"
  | "xri_mismatch_last_hop"
  | "peer_unknown";

export type HopInfo = { family: IpFamily; scope: IpScope };

export type ClientIpObservation = {
  classification: Classification;
  source: CandidateSource;
  /** Full candidate address. In-process only: never logged or aggregated. */
  candidate: string | null;
  peer: HopInfo & { mapped: boolean };
  forwardedFor: { present: boolean; headerLines: number; hops: number; hopInfo: HopInfo[] };
  realIp: { present: boolean; valid: boolean; matchesLastHop: boolean | null };
  issues: ChainIssue[];
};

export type TrustPolicy = {
  /** TCP peers allowed to set forwarding headers (e.g. the platform edge). */
  trustedProxies: BlockList | null;
  /** Number of trusted proxies that appended to X-Forwarded-For (>= 1 when trustedProxies is set). */
  trustedHops: number;
};

/** Production policy for this phase: trust nothing. */
export const NO_TRUST: TrustPolicy = Object.freeze({ trustedProxies: null, trustedHops: 0 });

export const MAX_FORWARDED_HEADER_LENGTH = 1024;
export const MAX_FORWARDED_HOPS = 20;

/** Builds a policy from explicit CIDRs (tests and a future, evidence-based configuration). */
export function trustPolicyFrom(cidrs: string[], trustedHops: number): TrustPolicy {
  if (!Number.isInteger(trustedHops) || trustedHops < 1 || trustedHops > 5) {
    throw new Error("trustedHops must be an integer between 1 and 5");
  }
  const list = new BlockList();
  for (const cidr of cidrs) {
    const [address, prefixText] = cidr.trim().split("/");
    const family = isIP(address);
    const prefix = Number(prefixText);
    if (!family || !Number.isInteger(prefix) || prefix < 0 || prefix > (family === 4 ? 32 : 128)) {
      throw new Error(`invalid trusted proxy CIDR: ${cidr}`);
    }
    list.addSubnet(address, prefix, family === 4 ? "ipv4" : "ipv6");
  }
  return { trustedProxies: list, trustedHops };
}

/** Strips brackets/ports/zones and unwraps IPv4-mapped IPv6. Returns null if not an IP. */
export function normalizeIp(raw: unknown): { address: string; family: 4 | 6; mapped: boolean } | null {
  if (typeof raw !== "string") return null;
  let value = raw.trim();
  if (!value || value.length > 64) return null;
  // "[2001:db8::1]:443" or "[2001:db8::1]"
  const bracketed = value.match(/^\[([^\]]+)\](?::\d{1,5})?$/);
  if (bracketed) value = bracketed[1];
  // "203.0.113.7:51234" (IPv4 with port only; a bare IPv6 has several colons)
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d{1,5}$/.test(value)) value = value.slice(0, value.lastIndexOf(":"));
  value = value.replace(/%[\w.-]+$/, ""); // zone id
  const family = isIP(value);
  if (!family) return null;
  const mapped = family === 6 && /^::ffff:/i.test(value) && isIP(value.slice(7)) === 4;
  if (mapped) return { address: value.slice(7), family: 4, mapped: true };
  return { address: family === 6 ? value.toLowerCase() : value, family: family as 4 | 6, mapped: false };
}

const PRIVATE_V4 = new BlockList();
PRIVATE_V4.addSubnet("10.0.0.0", 8, "ipv4");
PRIVATE_V4.addSubnet("172.16.0.0", 12, "ipv4");
PRIVATE_V4.addSubnet("192.168.0.0", 16, "ipv4");
PRIVATE_V4.addSubnet("100.64.0.0", 10, "ipv4"); // CGNAT / some platform internals
const PRIVATE_V6 = new BlockList();
PRIVATE_V6.addSubnet("fc00::", 7, "ipv6"); // unique local (e.g. platform private networks)

export function scopeOf(address: string, family: 4 | 6): IpScope {
  if (family === 4) {
    if (address.startsWith("127.")) return "loopback";
    if (address.startsWith("169.254.")) return "link-local";
    return PRIVATE_V4.check(address, "ipv4") ? "private" : "public";
  }
  if (address === "::1") return "loopback";
  if (/^fe[89ab]/i.test(address)) return "link-local";
  return PRIVATE_V6.check(address, "ipv6") ? "private" : "public";
}

function hopInfo(normalized: ReturnType<typeof normalizeIp>): HopInfo {
  if (!normalized) return { family: "unknown", scope: "unknown" };
  return { family: normalized.family === 4 ? "ipv4" : "ipv6", scope: scopeOf(normalized.address, normalized.family) };
}

function headerLines(req: IncomingMessage, name: string): string[] {
  const distinct = (req as IncomingMessage & { headersDistinct?: Record<string, string[] | undefined> })?.headersDistinct?.[name];
  if (Array.isArray(distinct)) return distinct;
  const raw = req?.headers?.[name];
  if (raw === undefined) return [];
  return Array.isArray(raw) ? raw : [String(raw)];
}

function isTrustedPeer(policy: TrustPolicy, peer: ReturnType<typeof normalizeIp>): boolean {
  if (!policy.trustedProxies || !peer) return false;
  return policy.trustedProxies.check(peer.address, peer.family === 4 ? "ipv4" : "ipv6");
}

/** Pure observation of one request. Never throws. */
export function observeClientIpChain(req: IncomingMessage, policy: TrustPolicy = NO_TRUST): ClientIpObservation {
  const issues = new Set<ChainIssue>();
  const peer = normalizeIp(req?.socket?.remoteAddress);
  if (!peer) issues.add("peer_unknown");

  // X-Forwarded-For: several header lines are concatenated in order, as proxies do.
  const xffLines = headerLines(req, "x-forwarded-for");
  if (xffLines.length > 1) issues.add("xff_repeated_header");
  const xffRaw = xffLines.join(",");
  let entries: string[] = [];
  if (xffRaw.length > MAX_FORWARDED_HEADER_LENGTH) issues.add("xff_too_long");
  else if (xffLines.length) entries = xffRaw.split(",").map((entry) => entry.trim());
  if (entries.length > MAX_FORWARDED_HOPS) {
    issues.add("xff_too_many_hops");
    entries = [];
  }
  const normalizedHops = entries.map((entry) => normalizeIp(entry));
  if (normalizedHops.some((hop) => !hop)) issues.add("xff_malformed_entry");

  // X-Real-IP: exactly one address when present.
  const xriLines = headerLines(req, "x-real-ip");
  const xriJoined = xriLines.join(",");
  const xriRepeated = xriLines.length > 1 || xriJoined.includes(",");
  if (xriRepeated) issues.add("xri_repeated");
  const realIp = xriLines.length && !xriRepeated ? normalizeIp(xriJoined) : null;
  if (xriLines.length && !xriRepeated && !realIp) issues.add("xri_malformed");
  const lastHop = normalizedHops.length ? normalizedHops[normalizedHops.length - 1] : null;
  const matchesLastHop = realIp && lastHop ? realIp.address === lastHop.address : null;
  if (matchesLastHop === false) issues.add("xri_mismatch_last_hop");

  const invalid =
    issues.has("xff_malformed_entry") || issues.has("xff_too_long") || issues.has("xff_too_many_hops") ||
    issues.has("xri_malformed") || issues.has("xri_repeated");

  let classification: Classification = invalid ? "invalid" : "unverified";
  let source: CandidateSource = "none";
  let candidate: string | null = null;

  if (!invalid && isTrustedPeer(policy, peer) && policy.trustedHops >= 1 && normalizedHops.length >= policy.trustedHops) {
    // Count from the right: each trusted proxy appended the address it saw. Never the leftmost.
    const chosen = normalizedHops[normalizedHops.length - policy.trustedHops];
    if (chosen) {
      classification = "verified";
      source = "forwarded-for";
      candidate = chosen.address;
    }
  }
  if (classification !== "verified" && !invalid) {
    // Unverified candidate: what the nearest hop reported (rightmost), never the client-chosen
    // leftmost value; then X-Real-IP; then the TCP peer itself.
    if (lastHop) { source = "forwarded-for"; candidate = lastHop.address; }
    else if (realIp) { source = "real-ip"; candidate = realIp.address; }
    else if (peer) { source = "connection"; candidate = peer.address; }
  }

  return {
    classification,
    source,
    candidate,
    peer: { ...hopInfo(peer), mapped: Boolean(peer?.mapped) },
    forwardedFor: { present: xffLines.length > 0, headerLines: xffLines.length, hops: entries.length, hopInfo: normalizedHops.map(hopInfo) },
    realIp: { present: xriLines.length > 0, valid: Boolean(realIp), matchesLastHop },
    issues: [...issues].sort(),
  };
}

/**
 * Aggregated counters with a fixed set of low-cardinality dimensions (no addresses, no hashes).
 * Snapshots are logged periodically and reset, so memory and log volume stay bounded.
 */
export class ClientIpChainMetrics {
  private readonly buckets = new Map<string, number>();
  private readonly issueCounts = new Map<ChainIssue, number>();
  private total = 0;
  static readonly MAX_BUCKETS = 512;

  record(observation: ClientIpObservation) {
    this.total++;
    const hops = observation.forwardedFor.hops;
    const key = [
      observation.classification,
      observation.source,
      `hops=${hops >= 4 ? "4+" : hops}`,
      `xri=${!observation.realIp.present ? "absent" : !observation.realIp.valid ? "invalid" : observation.realIp.matchesLastHop === false ? "mismatch" : "ok"}`,
      `peer=${observation.peer.family}/${observation.peer.scope}`,
      `last=${observation.forwardedFor.hopInfo[observation.forwardedFor.hopInfo.length - 1]?.scope ?? "none"}`,
    ].join("|");
    if (this.buckets.has(key) || this.buckets.size < ClientIpChainMetrics.MAX_BUCKETS) {
      this.buckets.set(key, (this.buckets.get(key) ?? 0) + 1);
    } else {
      this.buckets.set("overflow", (this.buckets.get("overflow") ?? 0) + 1);
    }
    for (const issue of observation.issues) this.issueCounts.set(issue, (this.issueCounts.get(issue) ?? 0) + 1);
  }

  snapshot() {
    return {
      total: this.total,
      buckets: [...this.buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50).map(([shape, count]) => ({ shape, count })),
      issues: Object.fromEntries([...this.issueCounts.entries()].sort()),
    };
  }

  /** Returns the snapshot and starts a new window. */
  drain() {
    const snapshot = this.snapshot();
    this.buckets.clear();
    this.issueCounts.clear();
    this.total = 0;
    return snapshot;
  }
}

export const clientIpChainMetrics = new ClientIpChainMetrics();

export const SUMMARY_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Express middleware: observe and count, nothing else. Never alters the request, never throws
 * and never blocks. A summary line (counts only) is written once per window when there was traffic.
 */
export function clientIpObservationMiddleware(
  metrics: ClientIpChainMetrics = clientIpChainMetrics,
  log: (line: string) => void = (line) => console.info(line),
  intervalMs = SUMMARY_INTERVAL_MS,
) {
  const timer = setInterval(() => {
    const snapshot = metrics.drain();
    if (snapshot.total > 0) log(JSON.stringify({ event: "client_ip_chain_summary", windowMs: intervalMs, ...snapshot }));
  }, intervalMs);
  timer.unref?.();
  const middleware = (req: IncomingMessage, _res: unknown, next: () => void) => {
    try {
      metrics.record(observeClientIpChain(req));
    } catch {
      // Observation must never affect the request.
    }
    next();
  };
  return Object.assign(middleware, { stop: () => clearInterval(timer) });
}

/** Partial form of an address: first two IPv4 octets or first two IPv6 groups. Never the full address. */
export function maskAddress(address: string, family: 4 | 6): string {
  if (family === 4) return `${address.split(".").slice(0, 2).join(".")}.•.•`;
  const groups = address.split(":").filter(Boolean);
  return `${groups.slice(0, 2).join(":")}:…`;
}

export type DiagnosticAddressMode = "masked" | "full";

/**
 * What a platform operator may see about *their own* request: shapes and scopes, plus the
 * public addresses in the chain (their own address and the proxies'), never private/internal
 * addresses, header values other than addresses, cookies or tokens. With `addresses: "masked"`
 * public addresses are reduced to a partial form, so the response carries no full address.
 * The comparisons (X-Real-IP vs first/last hop) are computed on the full values server-side.
 */
export function selfDiagnostic(req: IncomingMessage, options: { addresses?: DiagnosticAddressMode } = {}) {
  const mode: DiagnosticAddressMode = options.addresses === "masked" ? "masked" : "full";
  const observation = observeClientIpChain(req);
  const xffLines = headerLines(req, "x-forwarded-for");
  const rawHops = xffLines.join(",").length <= MAX_FORWARDED_HEADER_LENGTH ? xffLines.join(",").split(",").map((e) => e.trim()).filter(Boolean) : [];
  const publicOrMasked = (raw: string) => {
    const normalized = normalizeIp(raw);
    if (!normalized) return "invalid";
    if (scopeOf(normalized.address, normalized.family) !== "public") return `<${scopeOf(normalized.address, normalized.family)}>`;
    return mode === "masked" ? maskAddress(normalized.address, normalized.family) : normalized.address;
  };
  const xri = headerLines(req, "x-real-ip");
  const realIp = xri.length === 1 && !xri[0].includes(",") ? normalizeIp(xri[0]) : null;
  const firstHop = rawHops.length ? normalizeIp(rawHops[0]) : null;
  const matchesFirstHop = realIp && firstHop ? realIp.address === firstHop.address : null;
  return {
    policy: "observation-only (no proxy is trusted; nothing is used for security decisions)",
    addresses: mode,
    classification: observation.classification,
    source: observation.source,
    issues: observation.issues,
    peer: observation.peer,
    forwardedFor: {
      present: observation.forwardedFor.present,
      headerLines: observation.forwardedFor.headerLines,
      hops: observation.forwardedFor.hops,
      // Left (client-supplied) to right (added by the nearest proxy).
      chain: rawHops.slice(0, MAX_FORWARDED_HOPS).map((hop, index) => ({ position: index, address: publicOrMasked(hop), ...observation.forwardedFor.hopInfo[index] })),
    },
    realIp: {
      ...observation.realIp,
      matchesFirstHop,
      address: xri.length === 1 ? publicOrMasked(xri[0]) : xri.length ? "repeated" : null,
    },
  };
}
