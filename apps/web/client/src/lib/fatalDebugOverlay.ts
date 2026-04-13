import { getLastPhase, getPhaseHistory } from "@/lib/bootPhase";

export type FatalDebugPayload = {
  phase?: string;
  title?: string;
  message?: string;
  stack?: string;
  componentStack?: string;
  cause?: unknown;
  extra?: unknown;
  url?: string;
  timestamp?: string;
};

const OVERLAY_ID = "nexo-fatal-debug-overlay";

function toText(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${value.stack ?? ""}`.trim();
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isDebugMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("fatalDebug") === "1";
}

function section(label: string, value?: unknown) {
  const text = toText(value).trim();
  if (!text) return "";
  return `<div style="margin-top:12px;"><div style="font-size:12px;color:#fda4af;text-transform:uppercase;">${label}</div><pre style="white-space:pre-wrap;overflow:auto;background:#020617;padding:12px;border-radius:8px;border:1px solid #334155;">${text.replace(/</g, "&lt;")}</pre></div>`;
}

export function clearFatalDebugOverlay() {
  if (typeof document === "undefined") return;
  document.getElementById(OVERLAY_ID)?.remove();
}

export function showFatalDebugOverlay(payload: FatalDebugPayload) {
  if (typeof document === "undefined") return;

  const url = payload.url ?? (typeof window !== "undefined" ? window.location.href : "unknown");
  const phase = payload.phase ?? getLastPhase();
  const timestamp = payload.timestamp ?? new Date().toISOString();
  const title = payload.title ?? "Falha fatal no frontend";
  const message = payload.message ?? "Erro desconhecido";
  const debugMode = isDebugMode();
  const history = getPhaseHistory();

  const html = `
    <div id="${OVERLAY_ID}" style="position:fixed;inset:0;z-index:2147483647;background:#020617;color:#e2e8f0;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;overflow:auto;">
      <div style="max-width:1100px;margin:0 auto;padding:20px;">
        <h1 style="margin:0 0 8px;font-size:22px;color:#fb7185;">${title}</h1>
        <p style="margin:0;color:#cbd5e1;">${message.replace(/</g, "&lt;")}</p>
        <div style="margin-top:12px;display:grid;gap:8px;">
          <div><strong>Fase da falha:</strong> ${phase.replace(/</g, "&lt;")}</div>
          <div><strong>Última fase conhecida:</strong> ${getLastPhase().replace(/</g, "&lt;")}</div>
          <div><strong>URL:</strong> ${url.replace(/</g, "&lt;")}</div>
          <div><strong>Timestamp:</strong> ${timestamp}</div>
        </div>
        ${section("Stack", payload.stack)}
        ${section("Component Stack", payload.componentStack)}
        ${section("Cause", payload.cause)}
        ${section("Extra", payload.extra)}
        ${debugMode ? section("Últimas fases", history.join("\n")) : ""}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">
          <button onclick="window.location.reload()" style="border:0;background:#f97316;color:#fff;padding:10px 14px;border-radius:8px;cursor:pointer;">Recarregar página</button>
          <button onclick="navigator.clipboard?.writeText(document.getElementById('${OVERLAY_ID}')?.innerText || '')" style="border:1px solid #64748b;background:transparent;color:#e2e8f0;padding:10px 14px;border-radius:8px;cursor:pointer;">Copiar diagnóstico</button>
        </div>
      </div>
    </div>
  `;

  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    existing.outerHTML = html;
    return;
  }

  document.body.innerHTML = html;
}
