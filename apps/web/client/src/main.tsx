import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import ErrorBoundary from "./components/ErrorBoundary";
import App from "./App";
import "./index.css";
import { setBootPhase, getLastPhase } from "@/lib/bootPhase";
import { showFatalDebugOverlay } from "@/lib/fatalDebugOverlay";
import { getQueryClient, getTrpcClient, trpc } from "@/lib/trpc";
import {
  ensureAuditState,
  markAuditError,
  pushAuditEvent,
  setAuditField,
} from "@/lib/renderAudit";

// Primeiro código executável do bootstrap do frontend.
// eslint-disable-next-line no-console
console.log("[MAIN] start");

const ROOT_ID = "root";

type RenderAuditMode = "bare-html" | "minimal" | "static-react" | "app";

function nowIso() {
  return new Date().toISOString();
}

function getRenderAuditMode(): RenderAuditMode {
  if (typeof window === "undefined") return "app";

  const params = new URLSearchParams(window.location.search);
  if (params.get("renderAudit") === "1" && !params.get("renderAuditMode")) {
    return "app";
  }

  const mode = (params.get("renderAuditMode") ?? "").trim().toLowerCase();
  if (mode === "bare-html") return "bare-html";
  if (mode === "minimal") return "minimal";
  if (mode === "static-react") return "static-react";
  return "app";
}

function normalizeError(errorLike: unknown) {
  if (errorLike instanceof Error) {
    return {
      message: errorLike.message,
      stack: errorLike.stack,
      cause: (errorLike as Error & { cause?: unknown }).cause,
    };
  }

  return {
    message: typeof errorLike === "string" ? errorLike : "Erro desconhecido",
    stack: undefined,
    cause: errorLike,
  };
}

function handleFatalError(title: string, errorLike: unknown, extra?: unknown) {
  const parsed = normalizeError(errorLike);
  markAuditError("runtime", errorLike);

  showFatalDebugOverlay({
    title,
    phase: getLastPhase(),
    message: parsed.message,
    stack: parsed.stack,
    cause: parsed.cause,
    extra,
    url: typeof window !== "undefined" ? window.location.href : "unknown",
    timestamp: nowIso(),
  });
}

function renderDomFatalFallback(title: string, errorLike: unknown) {
  if (typeof document === "undefined") return;
  const parsed = normalizeError(errorLike);
  const panel = document.createElement("div");
  panel.id = "main-dom-fatal-fallback";
  panel.style.cssText = "position:fixed;inset:12px;z-index:2147483647;background:#111827;color:#fee2e2;border:1px solid #7f1d1d;border-radius:10px;padding:14px;overflow:auto;font:600 12px/1.45 system-ui";
  panel.innerHTML = `
    <div style="font-size:16px;margin-bottom:6px;color:#fecaca">Erro antes do React</div>
    <div><strong>Título:</strong> ${title.replace(/</g, "&lt;")}</div>
    <div><strong>Mensagem:</strong> ${(parsed.message || "Erro desconhecido").replace(/</g, "&lt;")}</div>
    <div><strong>Pathname:</strong> ${(typeof window !== "undefined" ? window.location.pathname : "unknown").replace(/</g, "&lt;")}</div>
    <pre style="margin-top:10px;white-space:pre-wrap;background:#020617;border:1px solid #334155;border-radius:8px;padding:10px;color:#e2e8f0">${(parsed.stack || "(stack indisponível)").replace(/</g, "&lt;")}</pre>
    <button onclick="window.location.reload()" style="margin-top:10px;background:#f97316;color:#fff;border:0;border-radius:6px;padding:8px 10px;cursor:pointer">Recarregar</button>
  `;
  document.body.appendChild(panel);
}

function installGlobalErrorHooks() {
  window.addEventListener("error", (event) => {
    const parsed = normalizeError(event.error ?? event.message);
    setBootPhase("WINDOW_ONERROR");
    pushAuditEvent("window", "error", {
      pathname: window.location.pathname,
      message: String(event.message),
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
    markAuditError("runtime", event.error ?? event.message);
    // eslint-disable-next-line no-console
    console.error("[WINDOW_ERROR]", {
      at: nowIso(),
      pathname: window.location.pathname,
      message: String(event.message),
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: parsed.stack,
    });

    handleFatalError("Erro global não tratado", event.error ?? String(event.message), {
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      rawMessage: event.message,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const parsed = normalizeError(event.reason);
    setBootPhase("WINDOW_UNHANDLED_REJECTION");
    pushAuditEvent("window", "unhandledrejection", {
      pathname: window.location.pathname,
      message: parsed.message,
    });
    markAuditError("runtime", event.reason);
    // eslint-disable-next-line no-console
    console.error("[UNHANDLED_PROMISE]", {
      at: nowIso(),
      pathname: window.location.pathname,
      message: parsed.message,
      stack: parsed.stack,
      reason: event.reason,
    });

    handleFatalError("Promise rejeitada sem catch", event.reason, {
      type: "unhandledrejection",
    });
  });
}

function dispatchAuditEvent(name: "nexo:app-render-dispatched" | "nexo:app-mounted") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name));
}

function mountApp() {
  ensureAuditState();
  installGlobalErrorHooks();
  setBootPhase("BOOT_START");

  const pathname = typeof window === "undefined" ? "unknown" : window.location.pathname;
  const readyState = typeof document === "undefined" ? "unknown" : document.readyState;
  const title = typeof document === "undefined" ? "unknown" : document.title;
  const renderAuditMode = getRenderAuditMode();

  setAuditField("pathname", pathname);
  setAuditField("readyState", readyState);
  setAuditField("title", title);
  setAuditField("renderAuditMode", renderAuditMode);
  pushAuditEvent("main", "bootstrap:start", { pathname, readyState, title, renderAuditMode });

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[MAIN] bootstrap", { at: nowIso(), pathname, readyState, title, renderAuditMode });
  }

  const rootElement = document.getElementById(ROOT_ID);
  setAuditField("rootFound", Boolean(rootElement));
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[MAIN] root lookup", { found: Boolean(rootElement), rootId: ROOT_ID });
  }

  if (!rootElement) {
    setBootPhase("ROOT_NOT_FOUND");
    markAuditError("bootstrap", `Root element #${ROOT_ID} not found`);
    renderDomFatalFallback("Falha de bootstrap do frontend", new Error(`Root element #${ROOT_ID} not found`));
    handleFatalError("Falha de bootstrap do frontend", new Error(`Root element #${ROOT_ID} not found`));
    return;
  }

  if (renderAuditMode === "bare-html") {
    setBootPhase("AUDIT_BARE_HTML");
    pushAuditEvent("main", "audit:bare-html", { pathname });
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[MAIN] bare-html mode: React mount skipped", { at: nowIso() });
    }
    return;
  }

  setBootPhase("ROOT_FOUND");

  try {
    setAuditField("createRootStartedAt", nowIso());
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[MAIN] createRoot:start", { at: nowIso() });
    }
    const root = createRoot(rootElement);
    setAuditField("createRootDoneAt", nowIso());
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[MAIN] createRoot:done", { at: nowIso() });
    }

    setBootPhase("APP_RENDER_START");
    pushAuditEvent("main", "render:start", { renderAuditMode });

    if (renderAuditMode === "minimal") {
      root.render(
        <div
          data-debug="minimal-client-render-ok"
          style={{
            minHeight: "100vh",
            display: "grid",
            placeContent: "center",
            background: "#052e16",
            color: "#ecfdf5",
            font: "700 18px/1.2 system-ui",
          }}
        >
          MINIMAL CLIENT RENDER OK
        </div>
      );
      setAuditField("appRenderDispatchedAt", nowIso());
      dispatchAuditEvent("nexo:app-render-dispatched");
      return;
    }

    if (renderAuditMode === "static-react") {
      root.render(
        <React.StrictMode>
          <div
            data-debug="static-react-render-ok"
            style={{
              minHeight: "100vh",
              display: "grid",
              placeContent: "center",
              background: "#082f49",
              color: "#e0f2fe",
              font: "700 18px/1.2 system-ui",
            }}
          >
            STATIC REACT OK
          </div>
        </React.StrictMode>
      );
      setAuditField("appRenderDispatchedAt", nowIso());
      dispatchAuditEvent("nexo:app-render-dispatched");
      return;
    }

    const queryClient = getQueryClient();
    const trpcClient = getTrpcClient();

    root.render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <ErrorBoundary routeContext="root">
              <App />
            </ErrorBoundary>
          </trpc.Provider>
        </QueryClientProvider>
      </React.StrictMode>
    );

    setBootPhase("APP_RENDER_DISPATCHED");
    setAuditField("appRenderDispatchedAt", nowIso());
    pushAuditEvent("main", "render:dispatched", { pathname });
    dispatchAuditEvent("nexo:app-render-dispatched");
  } catch (error) {
    setBootPhase("APP_RENDER_FATAL");
    markAuditError("bootstrap", error);
    renderDomFatalFallback("Falha crítica ao inicializar React", error);
    handleFatalError("Falha crítica ao inicializar React", error, {
      pathname,
      readyState,
      title,
    });
  }
}

mountApp();
