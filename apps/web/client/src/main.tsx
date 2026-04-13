import React from "react";
import { createRoot } from "react-dom/client";

import ErrorBoundary from "./components/ErrorBoundary";
import App from "./App";
import "./index.css";
import { setBootPhase, getLastPhase } from "@/lib/bootPhase";
import { showFatalDebugOverlay } from "@/lib/fatalDebugOverlay";

const ROOT_ID = "root";

function shouldRunBootProbe() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("bootProbe") === "1";
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

  const rootElement = document.getElementById(ROOT_ID);
  if (!rootElement) {
    setBootPhase("ROOT_NOT_FOUND");
    handleFatalError("Falha de bootstrap do frontend", new Error(`Root element #${ROOT_ID} not found`));
    return;
  }

  setBootPhase("ROOT_FOUND");
  const root = createRoot(rootElement);
  const useProbe = shouldRunBootProbe();

  setBootPhase("APP_RENDER_START");
  root.render(
    <React.StrictMode>
      {useProbe ? (
        <div data-testid="boot-probe">NexoGestão boot probe</div>
      ) : (
        <ErrorBoundary routeContext="root">
          <App />
        </ErrorBoundary>
      )}
    </React.StrictMode>
  );
  setBootPhase("APP_RENDER_DISPATCHED");
}

window.onerror = (message, source, lineno, colno, error) => {
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
  setBootPhase("WINDOW_UNHANDLED_REJECTION");
  handleFatalError("Promise rejeitada sem catch", event.reason, {
    type: "unhandledrejection",
  });
};

try {
  mountApp();
} catch (error) {
  setBootPhase("BOOTSTRAP_CRASH");
  handleFatalError("Falha de bootstrap do frontend", error);
}
