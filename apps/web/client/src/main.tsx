import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import ErrorBoundary from "./components/ErrorBoundary";
import App from "./App";
import "./index.css";
import { setBootPhase } from "@/lib/bootPhase";
import { showFatalDebugOverlay } from "@/lib/fatalDebugOverlay";
import { getQueryClient, getTrpcClient, trpc } from "@/lib/trpc";

const ROOT_ID = "root";

function normalizeError(errorLike: unknown) {
  if (errorLike instanceof Error) {
    return { message: errorLike.message, stack: errorLike.stack };
  }

  return { message: typeof errorLike === "string" ? errorLike : "Erro desconhecido", stack: undefined };
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
    <pre style="margin-top:10px;white-space:pre-wrap;background:#020617;border:1px solid #334155;border-radius:8px;padding:10px;color:#e2e8f0">${(parsed.stack || "(stack indisponível)").replace(/</g, "&lt;")}</pre>
  `;
  document.body.appendChild(panel);
}

function mountApp() {
  const rootElement = document.getElementById(ROOT_ID);
  if (!rootElement) {
    const error = new Error(`Root element #${ROOT_ID} not found`);
    setBootPhase("ROOT_NOT_FOUND");
    renderDomFatalFallback("Falha de bootstrap do frontend", error);
    showFatalDebugOverlay({ title: "Falha de bootstrap do frontend", phase: "ROOT_NOT_FOUND", message: error.message, stack: error.stack, url: window.location.href, timestamp: new Date().toISOString() });
    return;
  }

  try {
    setBootPhase("APP_RENDER_START");
    const root = createRoot(rootElement);
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
  } catch (error) {
    setBootPhase("APP_RENDER_FATAL");
    renderDomFatalFallback("Falha crítica ao inicializar React", error);
    const parsed = normalizeError(error);
    showFatalDebugOverlay({ title: "Falha crítica ao inicializar React", phase: "APP_RENDER_FATAL", message: parsed.message, stack: parsed.stack, url: window.location.href, timestamp: new Date().toISOString() });
  }
}

mountApp();
