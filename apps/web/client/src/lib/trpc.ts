import { QueryClient } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

function resolveTrpcUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:5173/api/trpc";
  }

  return `${window.location.origin}/api/trpc`;
}

let queryClientSingleton: QueryClient | null = null;
let trpcClientSingleton: ReturnType<typeof trpc.createClient> | null = null;
let trpcProviderMounted = false;

export function getQueryClient() {
  if (!queryClientSingleton) {
    queryClientSingleton = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          refetchOnWindowFocus: false,
          retry: 1,
        },
        mutations: {
          retry: 0,
        },
      },
    });
  }

  return queryClientSingleton;
}

export function getTrpcClient() {
  if (!trpcClientSingleton) {
    trpcClientSingleton = trpc.createClient({
      links: [
        httpBatchLink({
          transformer: superjson,
          url: resolveTrpcUrl(),
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: "include",
            });
          },
        }),
      ],
    });
  }

  return trpcClientSingleton;
}

export function TRPCProvider({
  client,
  queryClient,
  children,
}: {
  client: ReturnType<typeof trpc.createClient>;
  queryClient: QueryClient;
  children: ReactNode;
}) {
  trpcProviderMounted = true;
  console.info("[BOOT] TRPCProvider ativo");
  return createElement(trpc.Provider, { client, queryClient, children });
}

export function useSafeTRPC() {
  if (!trpcProviderMounted) {
    throw new Error(
      "[DIAGNOSTIC] tRPC usado fora do provider. Garanta árvore: QueryClientProvider -> TRPCProvider -> ErrorBoundary -> App."
    );
  }
  return trpc.useUtils();
}
