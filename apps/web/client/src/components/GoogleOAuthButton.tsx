import { Button } from "@/components/ui/button";
import { Chrome } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Botão de login com Google OAuth
 * Redireciona para /api/oauth/google/login
 */
export function GoogleOAuthButton() {
  const [status, setStatus] = useState<{
    configured: boolean;
    message?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const response = await fetch("/api/oauth/google/status", { method: "GET" });
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        setStatus({
          configured: Boolean(payload?.configured),
          message:
            typeof payload?.message === "string"
              ? payload.message
              : payload?.configured
                ? "Google OAuth configurado."
                : "Google OAuth não configurado neste ambiente.",
        });
      } catch {
        if (cancelled) return;
        setStatus({
          configured: false,
          message: "Não foi possível validar Google OAuth agora.",
        });
      }
    };

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const search =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const redirectParam = (search?.get("redirect") ?? "").trim();
  const safeRedirect =
    redirectParam.startsWith("/") &&
    !redirectParam.startsWith("//") &&
    !redirectParam.startsWith("/login") &&
    !redirectParam.startsWith("/register") &&
    !redirectParam.startsWith("/forgot-password") &&
    !redirectParam.startsWith("/reset-password")
      ? redirectParam
      : "";

  const handleGoogleLogin = () => {
    if (status && !status.configured) return;
    const target = new URL("/api/oauth/google/login", window.location.origin);
    if (safeRedirect) {
      target.searchParams.set("redirect", safeRedirect);
    }
    window.location.href = target.toString();
  };

  return (
    <Button
      onClick={handleGoogleLogin}
      disabled={status ? !status.configured : true}
      variant="outline"
      className="w-full gap-2 border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-900"
      title={status?.configured ? "Entrar com Google" : status?.message}
    >
      <Chrome className="h-5 w-5" />
      {status
        ? status.configured
          ? "Entrar com Google"
          : "Google indisponível (configuração pendente)"
        : "Verificando Google..."}
    </Button>
  );
}
