import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import ErrorBoundary from "./components/ErrorBoundary";
import App from "./App";
import "./index.css";
import { setBootPhase, getLastPhase } from "@/lib/bootPhase";
import { showFatalDebugOverlay } from "@/lib/fatalDebugOverlay";
import { getQueryClient, getTrpcClient, trpc } from "@/lib/trpc";

const ROOT_ID = "root";

type RenderAuditMode = "minimal" | "static-react" | "app";

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

function installGlobalErrorHooks() {
  window.onerror = (message, source, lineno, colno, error) => {
    const parsed = normalizeError(error ?? message);
    // eslint-disable-next-line no-console
    console.error("[WINDOW_ERROR]", {
      at: nowIso(),
      pathname: window.location.pathname,
      message: String(message),
      source,
      lineno,
      colno,
      stack: parsed.stack,
    });

    setBootPhase("WINDOW_ONERROR");
    handleFatalError("Erro global não tratado", error ?? String(message), {
      source,
      lineno,
      colno,
      rawMessage: message,
    });
    return false;
  };

  window.onunhandledrejection = (event) => {
    const parsed = normalizeError(event.reason);
    // eslint-disable-next-line no-console
    console.error("[UNHANDLED_PROMISE]", {
      at: nowIso(),
      pathname: window.location.pathname,
      message: parsed.message,
      stack: parsed.stack,
      reason: event.reason,
    });

    setBootPhase("WINDOW_UNHANDLED_REJECTION");
    handleFatalError("Promise rejeitada sem catch", event.reason, {
      type: "unhandledrejection",
    });
  };
}

function mountApp() {
  installGlobalErrorHooks();
  setBootPhase("BOOT_START");

  const pathname = typeof window === "undefined" ? "unknown" : window.location.pathname;
  const readyState = typeof document === "undefined" ? "unknown" : document.readyState;
  const renderAuditMode = getRenderAuditMode();

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[MAIN] bootstrap", { at: nowIso(), pathname, readyState, renderAuditMode });
  }

  const rootElement = document.getElementById(ROOT_ID);
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[MAIN] root lookup", { found: Boolean(rootElement), rootId: ROOT_ID });
  }

  if (!rootElement) {
    setBootPhase("ROOT_NOT_FOUND");
    handleFatalError("Falha de bootstrap do frontend", new Error(`Root element #${ROOT_ID} not found`));
    return;
  }

  setBootPhase("ROOT_FOUND");

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[MAIN] createRoot:start", { at: nowIso() });
  }
  const root = createRoot(rootElement);

  setBootPhase("APP_RENDER_START");
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[MAIN] render:start", { at: nowIso(), renderAuditMode });
  }

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

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[MAIN] render:dispatched", { at: nowIso() });
  }

  setBootPhase("APP_RENDER_DISPATCHED");
}

mountApp();
