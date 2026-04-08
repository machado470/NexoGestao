import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

import { trpc } from "@/lib/trpc";

function extractToken() {
  if (typeof window === "undefined") return "";

  const search = new URLSearchParams(window.location.search);
  const fromQuery = (search.get("token") ?? "").trim();
  if (fromQuery) return fromQuery;

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;

  const hashParams = new URLSearchParams(hash);
  return (hashParams.get("token") ?? "").trim();
}

export default function AuthCallbackPage() {
  const [, navigate] = useLocation();
  const token = useMemo(() => extractToken(), []);

  const establishSessionMutation = trpc.nexo.auth.establishSession.useMutation();

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!token) {
        navigate("/login?error=missing_callback_token", { replace: true });
        return;
      }

      try {
        await establishSessionMutation.mutateAsync({ token });
        if (!active) return;
        navigate("/executive-dashboard", { replace: true });
      } catch {
        if (!active) return;
        navigate("/login?error=oauth_callback_failed", { replace: true });
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [establishSessionMutation, navigate, token]);

  return (
    <div className="nexo-app-shell flex min-h-screen items-center justify-center px-6">
      <div className="nexo-app-panel-strong w-full max-w-md p-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-orange-500" />
        <h1 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-white">
          Confirmando autenticação
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Estamos finalizando sua sessão com segurança.
        </p>
      </div>
    </div>
  );
}
