import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import ErrorBoundary from "./components/ErrorBoundary";
import App from "./App";
import "./index.css";
import { getQueryClient, getTrpcClient, TRPCProvider } from "@/lib/trpc";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element #root not found");
}

const queryClient = getQueryClient();
const trpcClient = getTrpcClient();

try {
  createRoot(root).render(
    <QueryClientProvider client={queryClient}>
      <TRPCProvider client={trpcClient} queryClient={queryClient}>
        <ErrorBoundary routeContext="root">
          <App />
        </ErrorBoundary>
      </TRPCProvider>
    </QueryClientProvider>
  );
} catch (e) {
  const error = e instanceof Error ? e : new Error(String(e));
  document.body.innerHTML = `
    <div style="padding:20px;font-family:sans-serif">
      <h1>Erro crítico no bootstrap</h1>
      <pre>${error.stack ?? error.message}</pre>
    </div>
  `;
}
