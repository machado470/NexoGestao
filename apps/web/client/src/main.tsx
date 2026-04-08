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

initSentry();

let isRedirectingToLogin = false;

const isPublicPath = (pathname: string): boolean => {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/auth/accept-invite" ||
    pathname === "/auth/callback" ||
    pathname === "/auth/confirm-email" ||
    pathname === "/about" ||
    pathname === "/privacy" ||
    pathname === "/terms"
  );
};

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
      refetchOnReconnect: true,
      refetchOnMount: false,
      retry(failureCount, error) {
        if (shouldRedirectToLogin(error)) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry(failureCount, error) {
        if (shouldRedirectToLogin(error)) return false;
        return failureCount < 1;
      },
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

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
