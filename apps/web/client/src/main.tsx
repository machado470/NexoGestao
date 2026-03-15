import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";

import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";
import { initSentry } from "./lib/sentry";

// Inicializar Sentry se configurado
initSentry();

const queryClient = new QueryClient();

const shouldRedirectToLogin = (error: unknown): boolean => {
  if (!(error instanceof TRPCClientError)) return false;

  const message = String(error.message ?? "").toLowerCase();

  return (
    message.includes("não autenticado") ||
    message.includes("unauthorized") ||
    message.includes("unauthenticated") ||
    message.includes("jwt") ||
    message.includes("token inválido") ||
    message.includes("token invalido")
  );
};

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (typeof window === "undefined") return;
  if (!shouldRedirectToLogin(error)) return;

  const currentPath = window.location.pathname;
  const isAlreadyPublic =
    currentPath === "/login" ||
    currentPath === "/register" ||
    currentPath === "/forgot-password" ||
    currentPath === "/reset-password";

  if (isAlreadyPublic) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
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

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
