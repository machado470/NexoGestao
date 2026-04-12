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
import "./index.css";
import { initSentry } from "./lib/sentry";
import { isPublicPath } from "./lib/publicRoutes";

const isDev = import.meta.env.DEV;

function devLog(prefix: string, payload?: unknown) {
  if (!isDev) return;
  // eslint-disable-next-line no-console
  console.log(prefix, payload ?? "");
}

function devError(prefix: string, payload?: unknown) {
  if (!isDev) return;
  // eslint-disable-next-line no-console
  console.error(prefix, payload ?? "");
}

function renderFatalBootError(message: string) {
  if (typeof document === "undefined") return;
  const fallback = document.getElementById("boot-fatal-error");
  if (fallback) {
    fallback.textContent = message;
    return;
  }

  const node = document.createElement("div");
  node.id = "boot-fatal-error";
  node.style.cssText =
    "padding:16px;margin:16px;border:1px solid #fca5a5;border-radius:12px;background:#fff1f2;color:#7f1d1d;font-family:system-ui,sans-serif;";
  node.textContent = message;
  document.body.prepend(node);
}

initSentry();
devLog("[BOOT] main start");

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
    throw new Error("[BOOT ERROR] Root #root não encontrado para montar a aplicação.");
  }

  devLog("[BOOT] app render start");

  createRoot(rootElement).render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );

  devLog("[BOOT] app render done");
} catch (error) {
  devError("[BOOT ERROR] bootstrap failure", {
    phase: "react-root-mount",
    message: error instanceof Error ? error.message : "Erro desconhecido",
    stack: error instanceof Error ? error.stack : undefined,
  });
  renderFatalBootError(
    "Falha crítica ao iniciar o app. Confira o console para detalhes de [BOOT ERROR]."
  );
}
