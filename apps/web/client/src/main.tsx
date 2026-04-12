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

initSentry();
// eslint-disable-next-line no-console
console.log("[boot] main_entry_loaded");

let isRedirectingToLogin = false;

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    // eslint-disable-next-line no-console
    console.error("[boot] window_error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    // eslint-disable-next-line no-console
    console.error("[boot] unhandled_rejection", {
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

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("[boot] Root #root não encontrado para montar a aplicação.");
}

// eslint-disable-next-line no-console
console.log("[boot] html_root_found");
// eslint-disable-next-line no-console
console.log("[boot] react_mount_start");

createRoot(rootElement).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

// eslint-disable-next-line no-console
console.log("[boot] react_mount_done");
