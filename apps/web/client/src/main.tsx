import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import ErrorBoundary from "./components/ErrorBoundary";
import App from "./App";
import "./index.css";
import { setBootPhase, getLastPhase } from "@/lib/bootPhase";
import { showFatalDebugOverlay } from "@/lib/fatalDebugOverlay";
import { getQueryClient, getTrpcClient, trpc } from "@/lib/trpc";

console.log("MAIN START");

const ROOT_ID = "root";
export const PROVIDER_TREE_ORDER = ["QueryClientProvider", "trpc.Provider", "ErrorBoundary", "App"] as const;

function ProvidersMountLogger() {
  React.useEffect(() => {
    if (!import.meta.env.DEV) return;
    // eslint-disable-next-line no-console
    console.info("[BOOT] QueryClientProvider mounted");
    return () => {
      // eslint-disable-next-line no-console
      console.info("[BOOT] QueryClientProvider unmounted");
    };
  }, []);

  return null;
}

function TrpcProviderMountLogger() {
  React.useEffect(() => {
    if (!import.meta.env.DEV) return;
    // eslint-disable-next-line no-console
    console.info("[BOOT] trpc.Provider mounted");
    return () => {
      // eslint-disable-next-line no-console
      console.info("[BOOT] trpc.Provider unmounted");
    };
  }, []);

  return null;
}


function AppMountLogger() {
  React.useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    // eslint-disable-next-line no-console
    console.info("[BOOT] App mounted", { pathname: window.location.pathname, providerOrder: PROVIDER_TREE_ORDER });
    return () => {
      // eslint-disable-next-line no-console
      console.info("[BOOT] App unmounted", { pathname: window.location.pathname });
    };
  }, []);

  return null;
}

function shouldRunBootProbe() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("bootProbe") === "1";
}

function isRenderAuditEnabled() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("renderAudit") === "1";
}

function shouldRunMinimalRenderProbe() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("renderAuditMode") === "minimal";
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
    timestamp: new Date().toISOString(),
  });
}

function mountApp() {
  setBootPhase("BOOT_START");
  const pathname = typeof window === "undefined" ? "unknown" : window.location.pathname;
  const renderAudit = isRenderAuditEnabled();
  const minimalProbe = shouldRunMinimalRenderProbe();
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[BOOT] pathname", pathname);
  }

  const rootElement = document.getElementById(ROOT_ID);
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[BOOT] root element found", rootElement);
  }
  if (!rootElement) {
    setBootPhase("ROOT_NOT_FOUND");
    handleFatalError("Falha de bootstrap do frontend", new Error(`Root element #${ROOT_ID} not found`));
    return;
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[BOOT] root element metadata", { id: rootElement.id, tagName: rootElement.tagName });
  }

  setBootPhase("ROOT_FOUND");
  const queryClient = getQueryClient();
  const trpcClient = getTrpcClient();
  const useProbe = shouldRunBootProbe();
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[BOOT] before createRoot");
  }
  const root = createRoot(rootElement);

  setBootPhase("APP_RENDER_START");
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[BOOT] before render");
  }
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ProvidersMountLogger />
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <TrpcProviderMountLogger />
          {minimalProbe ? (
            <div
              data-debug="minimal-client-render-ok"
              style={{ position: "fixed", bottom: 8, right: 8, zIndex: 2147483647, background: "#052e16", color: "#ecfdf5", padding: "6px 10px", borderRadius: 6, font: "600 12px/1.2 system-ui" }}
            >
              MINIMAL CLIENT RENDER OK
            </div>
          ) : useProbe ? (
            <div data-testid="boot-probe">NexoGestão boot probe</div>
          ) : (
            <ErrorBoundary routeContext="root">
              <AppMountLogger />
              {renderAudit ? (
                <div data-debug="main-render-ok" style={{ position: "relative", outline: "2px solid #f97316", outlineOffset: -2 }}>
                  <div style={{ position: "fixed", top: 8, right: 8, zIndex: 2147483647, background: "#7c2d12", color: "#fff7ed", padding: "6px 10px", borderRadius: 6, font: "600 12px/1.2 system-ui" }}>
                    MAIN RENDER OK
                  </div>
                  <App />
                </div>
              ) : (
                <App />
              )}
            </ErrorBoundary>
          )}
        </trpc.Provider>
      </QueryClientProvider>
    </React.StrictMode>
  );
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[BOOT] after render");
  }
  setBootPhase("APP_RENDER_DISPATCHED");
}

window.onerror = (message, source, lineno, colno, error) => {
  document.body.innerHTML = `
    <pre style="background:#000;color:#0f0;padding:20px;">
    WINDOW ERROR:
    ${String(message)}
    ${(error as Error | undefined)?.stack || ""}
    </pre>
  `;
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
  document.body.innerHTML = `
    <pre style="background:#000;color:#0f0;padding:20px;">
    PROMISE ERROR:
    ${String(event.reason)}
    </pre>
  `;
  setBootPhase("WINDOW_UNHANDLED_REJECTION");
  handleFatalError("Promise rejeitada sem catch", event.reason, {
    type: "unhandledrejection",
  });
};

mountApp();
