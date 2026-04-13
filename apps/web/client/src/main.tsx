import { trpc } from "@/lib/trpc";
import {
  QueryClient,
  QueryClientProvider,
  keepPreviousData,
} from "@tanstack/react-query";
import { httpLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";

import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";
import { initSentry } from "./lib/sentry";
import { isPublicPath } from "./lib/publicRoutes";

const isDev = import.meta.env.DEV;

function devLog(prefix: string, payload?: unknown) {
  // eslint-disable-next-line no-console
  console.log(prefix, payload ?? "");
  if (!isDev) return;
}

function devError(prefix: string, payload?: unknown) {
  // eslint-disable-next-line no-console
  console.error(prefix, payload ?? "");
  if (!isDev) return;
}

function formatErrorDetails(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}

${error.stack ?? "(stack indisponível)"}`;
  }

  return typeof error === "string" ? error : JSON.stringify(error, null, 2);
}

function ensureBootLogContainer(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;

  const existing = document.getElementById("boot-visual-log");
  if (existing instanceof HTMLDivElement) return existing;

  const panel = document.createElement("div");
  panel.id = "boot-visual-log";
  panel.style.cssText =
    "position:fixed;right:12px;bottom:12px;z-index:2147483647;max-width:min(92vw,560px);max-height:45vh;overflow:auto;padding:12px;border-radius:10px;border:1px solid #d4d4d8;background:#09090b;color:#fafafa;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5;box-shadow:0 8px 30px rgba(0,0,0,.45);";
  panel.setAttribute("aria-live", "polite");
  panel.textContent = "[BOOT] visual log started";

  document.body.appendChild(panel);
  return panel;
}

function appendBootVisualLog(message: string) {
  const panel = ensureBootLogContainer();
  if (!panel) return;
  panel.textContent = `${panel.textContent ?? ""}
${message}`;
}

function renderFatalBootError(message: string, error?: unknown) {
  if (typeof document === "undefined") return;

  const errorDetails = error ? formatErrorDetails(error) : "(sem detalhes)";
  const html = `
    <section style="padding:16px;margin:16px;border:1px solid #fca5a5;border-radius:12px;background:#fff1f2;color:#7f1d1d;font-family:system-ui,sans-serif;">
      <h1 style="margin:0 0 8px;font-size:18px;">Erro fatal de bootstrap</h1>
      <p style="margin:0 0 10px;white-space:pre-wrap;">${message}</p>
      <pre style="margin:0;padding:12px;border-radius:8px;background:#111827;color:#f9fafb;overflow:auto;white-space:pre-wrap;">${errorDetails}</pre>
    </section>
  `.trim();

  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = html;
    return;
  }

  document.body.innerHTML = html;
}

initSentry();
devLog("[BOOT] main start");
appendBootVisualLog("[BOOT] main start");

let isRedirectingToLogin = false;

if (typeof window !== "undefined" && isDev) {
  window.addEventListener("error", (event) => {
    devError("[RUNTIME ERROR] window.onerror", {
      phase: "window-error-listener",
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    devError("[RUNTIME ERROR] unhandledrejection", {
      phase: "promise-rejection",
      message:
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Promise rejeitada sem mensagem",
      stack: reason instanceof Error ? reason.stack : undefined,
      reason,
    });
  });
}

const shouldRedirectToLogin = (error: unknown): boolean => {
  if (!(error instanceof TRPCClientError)) return false;

  const message = String(error.message ?? "").toLowerCase().trim();

  return (
    message === "unauthorized" ||
    message === "unauthenticated" ||
    message.includes("não autenticado") ||
    message.includes("nao autenticado")
  );
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60_000,
      gcTime: 30 * 60_000,
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (typeof window === "undefined") return;
  if (isRedirectingToLogin) return;
  if (!shouldRedirectToLogin(error)) return;
  if (isPublicPath(window.location.pathname)) return;

  isRedirectingToLogin = true;
  const params = new URLSearchParams();
  const redirect = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (redirect && redirect.startsWith("/")) {
    params.set("redirect", redirect);
  }
  const next = params.toString() ? `/login?${params.toString()}` : "/login";
  window.location.assign(next);
};

queryClient.getQueryCache().subscribe((event) => {
  if (event.type !== "updated") return;
  if (event.action.type !== "error") return;

  const error = event.query.state.error;
  redirectToLoginIfUnauthorized(error);
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type !== "updated") return;
  if (event.action.type !== "error") return;

  const error = event.mutation.state.error;
  redirectToLoginIfUnauthorized(error);
});

const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

try {
  devLog("[BOOT] locating #root");
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    const rootMissingError = new Error("Root #root não encontrado para montar a aplicação.");
    appendBootVisualLog("[BOOT ERROR] #root inexistente");
    devError("[FATAL BOOT] #root inexistente", rootMissingError);
    renderFatalBootError("Elemento #root não encontrado. Não foi possível iniciar o frontend.", rootMissingError);
    throw rootMissingError;
  }

  appendBootVisualLog("[BOOT] root found");
  devLog("[BOOT] root found");

  appendBootVisualLog("[BOOT] rendering App");
  devLog("[BOOT] rendering App");

  const bootProbe =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("bootProbe")?.trim().toLowerCase()
      : null;

  if (bootProbe === "minimal") {
    appendBootVisualLog("[BOOT] minimal mode: providers/router/auth desativados");

    createRoot(rootElement).render(
      <ErrorBoundary routeContext="boot-root-minimal">
        <div style={{ padding: 16, fontFamily: "system-ui,sans-serif" }}>APP OK</div>
      </ErrorBoundary>
    );
  } else {
    createRoot(rootElement).render(
      <ErrorBoundary routeContext="boot-root">
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </trpc.Provider>
      </ErrorBoundary>
    );
  }

  appendBootVisualLog("[BOOT] render dispatched");
  devLog("[BOOT] render dispatched");
} catch (error) {
  appendBootVisualLog("[BOOT ERROR] erro capturado no bootstrap");
  devError("[FATAL BOOT] bootstrap failure", {
    phase: "react-root-mount",
    message: error instanceof Error ? error.message : "Erro desconhecido",
    stack: error instanceof Error ? error.stack : undefined,
  });
  renderFatalBootError("Falha crítica ao iniciar o app.", error);
}
