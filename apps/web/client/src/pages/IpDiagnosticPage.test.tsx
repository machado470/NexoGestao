import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  HEADER_COINCIDENCE_DISCLAIMER,
  IpDiagnosticAccessState,
  IpDiagnosticDisclaimer,
  IpDiagnosticResult,
} from "./IpDiagnosticPage";
import { buildIpDiagnosticView, diagnosticErrorKind, type IpDiagnosticPayload } from "./IpDiagnostic.logic";

// C7.2e diagnostic panel: status rendering, access states and privacy. Test addresses are from
// documentation ranges (RFC 5737 / RFC 3849).
const FULL_CLIENT = "198.51.100.23";
const FULL_EDGE = "203.0.113.9";

const productionShape = (addresses: "masked" | "full" = "masked"): IpDiagnosticPayload => ({
  self: {
    addresses,
    classification: "unverified",
    source: "forwarded-for",
    issues: ["xri_mismatch_last_hop"],
    peer: { family: "ipv4", scope: "private", mapped: false },
    forwardedFor: {
      present: true,
      headerLines: 1,
      hops: 2,
      chain: [
        { position: 0, address: addresses === "full" ? FULL_CLIENT : "198.51.•.•", family: "ipv4", scope: "public" },
        { position: 1, address: addresses === "full" ? FULL_EDGE : "203.0.•.•", family: "ipv4", scope: "public" },
      ],
    },
    realIp: { present: true, valid: true, matchesLastHop: false, matchesFirstHop: true, address: addresses === "full" ? FULL_CLIENT : "198.51.•.•" },
  },
  aggregate: { total: 92, buckets: [{ shape: "unverified|forwarded-for|hops=2|xri=mismatch|peer=ipv4/private|last=public", count: 91 }] },
});

describe("IP diagnostic view logic", () => {
  it("maps the observed production shape to simple answers", () => {
    const view = buildIpDiagnosticView(productionShape());
    expect(view.classification).toMatchObject({ key: "unverified", label: "Não verificado", tone: "warning" });
    expect(view).toMatchObject({ realIpPresent: "yes", realIpValid: "yes", matchesFirstHop: "yes", matchesLastHop: "no", hops: 2, addressesMode: "masked" });
    expect(view.peer).toBe("IPv4, privado");
    expect(view.alerts).toEqual([{ tone: "info", text: "O X-Real-IP é diferente da última entrada do X-Forwarded-For." }]);
  });

  it.each([
    ["verified", "Verificado", "success"],
    ["invalid", "Inválido", "danger"],
    ["weird", "Desconhecido", "neutral"],
  ])("classification %s → %s", (classification, label, tone) => {
    expect(buildIpDiagnosticView({ self: { classification } }).classification).toMatchObject({ label, tone });
  });

  it("raises topology alerts without exposing internal addresses", () => {
    const view = buildIpDiagnosticView({
      self: {
        classification: "invalid",
        issues: ["xff_malformed_entry", "xri_repeated", "something_new"],
        forwardedFor: { present: true, hops: 3, chain: [{ position: 0, address: "<private>", family: "ipv4", scope: "private" }] },
        realIp: { present: true, valid: false, matchesFirstHop: false, address: "repeated" },
      },
    });
    const texts = view.alerts.map((alert) => alert.text);
    expect(texts).toEqual(expect.arrayContaining([
      "Há uma entrada inválida no X-Forwarded-For.",
      "O X-Real-IP chegou repetido ou com vários valores.",
      "Foi detectada uma anomalia na cadeia de encaminhamento.",
      "O X-Real-IP é diferente da primeira entrada do X-Forwarded-For.",
      "A cadeia contém endereços não públicos (exibidos apenas como escopo).",
    ]));
    expect(view.chain[0].label).toBe("endereço privado (oculto)");
    expect(view.realIpLabel).toBe("repetido");
  });

  it("direct access without forwarding headers is flagged", () => {
    const view = buildIpDiagnosticView({ self: { classification: "unverified", forwardedFor: { present: false, hops: 0, chain: [] }, realIp: { present: false } } });
    expect(view.alerts[0].text).toContain("Nenhum header de encaminhamento");
    expect(view).toMatchObject({ realIpPresent: "no", realIpValid: "na", matchesFirstHop: "na", matchesLastHop: "na" });
  });

  it("is robust to an empty or malformed payload", () => {
    expect(() => buildIpDiagnosticView(null)).not.toThrow();
    expect(() => buildIpDiagnosticView({ self: { forwardedFor: { chain: "x" as any }, issues: "y" as any } })).not.toThrow();
  });

  it.each([
    [{ data: { code: "FORBIDDEN", httpStatus: 403 } }, "forbidden"],
    [{ data: { code: "UNAUTHORIZED" } }, "unauthorized"],
    [{ data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 } }, "rate_limited"],
    [{ data: { code: "SERVICE_UNAVAILABLE" } }, "unavailable"],
    [new Error("boom"), "error"],
    [null, "error"],
  ])("error %j → %s", (error, kind) => {
    expect(diagnosticErrorKind(error)).toBe(kind);
  });
});

describe("IP diagnostic screen", () => {
  it("renders the simple statuses and never a full address by default", () => {
    const html = renderToStaticMarkup(<IpDiagnosticResult view={buildIpDiagnosticView(productionShape())} />);
    for (const text of ["Diagnóstico autorizado", "Classificação: Não verificado", "X-Real-IP presente", "X-Real-IP válido", "X-Real-IP = primeiro X-Forwarded-For", "X-Real-IP = último X-Forwarded-For", "Saltos no X-Forwarded-For", "Alertas de topologia", "Endereços parciais"]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain(FULL_CLIENT);
    expect(html).not.toContain(FULL_EDGE);
    expect(html).toContain("198.51.•.•");
  });

  it("shows full addresses only when explicitly revealed, and flags it", () => {
    const html = renderToStaticMarkup(<IpDiagnosticResult view={buildIpDiagnosticView(productionShape("full"))} />);
    expect(html).toContain(FULL_CLIENT);
    expect(html).toContain("Endereços completos visíveis");
  });

  it("always states that header coincidence does not prove authenticity", () => {
    const html = renderToStaticMarkup(<IpDiagnosticDisclaimer />);
    expect(html).toContain("NÃO comprova que o IP de origem seja autêntico");
    expect(HEADER_COINCIDENCE_DISCLAIMER).toContain("NO_TRUST");
  });

  it.each([
    ["forbidden", "Acesso negado"],
    ["unauthorized", "Sessão expirada"],
    ["rate_limited", "Muitas consultas seguidas"],
    ["unavailable", "Serviço temporariamente indisponível"],
    ["error", "Não foi possível consultar o diagnóstico"],
  ] as const)("access state %s renders '%s' with a retry action", (kind, title) => {
    const html = renderToStaticMarkup(<IpDiagnosticAccessState kind={kind} onRetry={() => undefined} />);
    expect(html).toContain(title);
    expect(html).toContain("Verificar novamente");
    expect(html).not.toContain("Diagnóstico autorizado");
  });

  it("the route is protected and the page asks for masked addresses by default", () => {
    const app = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
    expect(app).toMatch(/<Route path="\/admin\/ip-diagnostic" component=\{IpDiagnosticRoute\} \/>/);
    expect(app).toMatch(/const IpDiagnosticRoute = lazyProtectedPage\(IpDiagnosticPage, \{\s*requiredRoles: \["ADMIN"\],/);
    const page = readFileSync(resolve(__dirname, "IpDiagnosticPage.tsx"), "utf8");
    expect(page).toContain('addresses: revealAddresses ? "full" : "masked"');
    expect(page).toContain("useState(false)");
    expect(page).not.toMatch(/localStorage|sessionStorage|(?<![A-Za-z.])fetch\(/); // no storage, no external lookup
  });
});
