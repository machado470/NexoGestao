import type { AppStatusTone } from "@/components/app-system";

/**
 * C7.2e — pure view logic of the platform IP chain diagnostic.
 *
 * Diagnostic only: nothing here (nor in the page) makes any address trusted. The backend keeps
 * NO_TRUST; this screen just explains the shape of the administrator's own request.
 */

export type ChainHop = { position: number; address: string; family?: string; scope?: string };

export type IpDiagnosticPayload = {
  self?: {
    addresses?: "masked" | "full";
    classification?: string;
    source?: string;
    issues?: string[];
    peer?: { family?: string; scope?: string; mapped?: boolean };
    forwardedFor?: { present?: boolean; headerLines?: number; hops?: number; chain?: ChainHop[] };
    realIp?: { present?: boolean; valid?: boolean; matchesLastHop?: boolean | null; matchesFirstHop?: boolean | null; address?: string | null };
  };
  aggregate?: { total?: number; buckets?: Array<{ shape: string; count: number }> };
};

export type YesNo = "yes" | "no" | "na";

export type IpDiagnosticView = {
  classification: { key: "verified" | "unverified" | "invalid" | "unknown"; label: string; tone: AppStatusTone; description: string };
  realIpPresent: YesNo;
  realIpValid: YesNo;
  matchesFirstHop: YesNo;
  matchesLastHop: YesNo;
  hops: number;
  headerLines: number;
  peer: string;
  addressesMode: "masked" | "full";
  chain: Array<{ position: number; label: string; detail: string }>;
  realIpLabel: string;
  alerts: Array<{ tone: AppStatusTone; text: string }>;
  aggregate: { total: number; buckets: Array<{ shape: string; count: number }> };
};

const CLASSIFICATION: Record<string, IpDiagnosticView["classification"]> = {
  verified: { key: "verified", label: "Verificado", tone: "success", description: "A cadeia passou por uma política de proxies confiáveis configurada explicitamente." },
  unverified: { key: "unverified", label: "Não verificado", tone: "warning", description: "Nenhum proxy é considerado confiável (NO_TRUST). Os headers são apenas observados." },
  invalid: { key: "invalid", label: "Inválido", tone: "danger", description: "Os headers de encaminhamento estão malformados, repetidos ou excessivos." },
};

const ISSUE_TEXT: Record<string, string> = {
  xff_malformed_entry: "Há uma entrada inválida no X-Forwarded-For.",
  xff_too_many_hops: "O X-Forwarded-For tem saltos demais e foi ignorado.",
  xff_too_long: "O X-Forwarded-For é longo demais e foi ignorado.",
  xff_repeated_header: "O X-Forwarded-For chegou em mais de uma linha de header.",
  xri_malformed: "O X-Real-IP não é um endereço válido.",
  xri_repeated: "O X-Real-IP chegou repetido ou com vários valores.",
  xri_mismatch_last_hop: "O X-Real-IP é diferente da última entrada do X-Forwarded-For.",
  peer_unknown: "Não foi possível identificar o endereço da conexão com o BFF.",
};

const SCOPE_LABEL: Record<string, string> = {
  public: "público",
  private: "privado",
  loopback: "loopback",
  "link-local": "link-local",
  unknown: "desconhecido",
};

function yesNo(value: boolean | null | undefined): YesNo {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "na";
}

export function yesNoLabel(value: YesNo): string {
  return value === "yes" ? "Sim" : value === "no" ? "Não" : "Não se aplica";
}

function familyLabel(family?: string) {
  return family === "ipv4" ? "IPv4" : family === "ipv6" ? "IPv6" : "família desconhecida";
}

/** Address text for display: masked/full public value, or only the scope for non-public hops. */
function addressLabel(address: string | null | undefined, scope?: string) {
  if (!address) return "—";
  if (address === "invalid") return "inválido";
  if (address === "repeated") return "repetido";
  if (address.startsWith("<")) return `endereço ${SCOPE_LABEL[scope ?? "unknown"] ?? "não público"} (oculto)`;
  return address;
}

export function buildIpDiagnosticView(payload: IpDiagnosticPayload | null | undefined): IpDiagnosticView {
  const self = payload?.self ?? {};
  const forwarded = self.forwardedFor ?? {};
  const realIp = self.realIp ?? {};
  const hops = Number(forwarded.hops ?? 0);
  const chain = Array.isArray(forwarded.chain) ? forwarded.chain : [];
  const issues = Array.isArray(self.issues) ? self.issues : [];
  const alerts: IpDiagnosticView["alerts"] = issues.map((issue) => ({
    tone: issue === "xri_mismatch_last_hop" ? "info" : "warning",
    text: ISSUE_TEXT[issue] ?? "Foi detectada uma anomalia na cadeia de encaminhamento.",
  }));
  if (!forwarded.present && !realIp.present) {
    alerts.push({ tone: "warning", text: "Nenhum header de encaminhamento chegou: acesso direto ao BFF ou topologia diferente da esperada." });
  }
  if (realIp.present === false && forwarded.present) {
    alerts.push({ tone: "warning", text: "O X-Real-IP não chegou nesta requisição." });
  }
  if (realIp.matchesFirstHop === false) {
    alerts.push({ tone: "warning", text: "O X-Real-IP é diferente da primeira entrada do X-Forwarded-For." });
  }
  if (chain.some((hop) => hop.scope && hop.scope !== "public")) {
    alerts.push({ tone: "info", text: "A cadeia contém endereços não públicos (exibidos apenas como escopo)." });
  }
  const classification = CLASSIFICATION[self.classification ?? ""] ?? {
    key: "unknown" as const,
    label: "Desconhecido",
    tone: "neutral" as const,
    description: "A resposta não trouxe uma classificação reconhecida.",
  };
  const buckets = Array.isArray(payload?.aggregate?.buckets) ? payload!.aggregate!.buckets! : [];
  return {
    classification,
    realIpPresent: yesNo(realIp.present),
    realIpValid: realIp.present ? yesNo(realIp.valid) : "na",
    matchesFirstHop: yesNo(realIp.matchesFirstHop),
    matchesLastHop: yesNo(realIp.matchesLastHop),
    hops,
    headerLines: Number(forwarded.headerLines ?? 0),
    peer: `${familyLabel(self.peer?.family)}, ${SCOPE_LABEL[self.peer?.scope ?? "unknown"] ?? "desconhecido"}${self.peer?.mapped ? " (IPv4 mapeado)" : ""}`,
    addressesMode: self.addresses === "full" ? "full" : "masked",
    chain: chain.map((hop) => ({
      position: hop.position,
      label: addressLabel(hop.address, hop.scope),
      detail: `${familyLabel(hop.family)}, ${SCOPE_LABEL[hop.scope ?? "unknown"] ?? "desconhecido"}`,
    })),
    realIpLabel: addressLabel(realIp.address),
    alerts,
    aggregate: { total: Number(payload?.aggregate?.total ?? 0), buckets: buckets.slice(0, 5) },
  };
}

export type DiagnosticErrorKind = "forbidden" | "unauthorized" | "rate_limited" | "unavailable" | "error";

export function diagnosticErrorKind(error: unknown): DiagnosticErrorKind {
  const data = (error as { data?: { code?: string; httpStatus?: number } } | null)?.data;
  const code = data?.code;
  const status = data?.httpStatus;
  if (code === "FORBIDDEN" || status === 403) return "forbidden";
  if (code === "UNAUTHORIZED" || status === 401) return "unauthorized";
  if (code === "TOO_MANY_REQUESTS" || status === 429) return "rate_limited";
  if (code === "SERVICE_UNAVAILABLE" || status === 503) return "unavailable";
  return "error";
}

export const DIAGNOSTIC_ERROR_TEXT: Record<DiagnosticErrorKind, { title: string; description: string }> = {
  forbidden: { title: "Acesso negado", description: "Este diagnóstico é restrito aos administradores da plataforma. A autorização é decidida pela API, não por esta tela." },
  unauthorized: { title: "Sessão expirada", description: "Entre novamente para consultar o diagnóstico." },
  rate_limited: { title: "Muitas consultas seguidas", description: "Aguarde alguns instantes antes de verificar novamente." },
  unavailable: { title: "Serviço temporariamente indisponível", description: "Tente novamente em alguns instantes." },
  error: { title: "Não foi possível consultar o diagnóstico", description: "Tente verificar novamente." },
};
