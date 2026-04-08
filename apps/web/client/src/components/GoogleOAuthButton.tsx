import { Button } from "@/components/ui/button";
import { Chrome } from "lucide-react";

/**
 * Botão de login com Google OAuth
 * Redireciona para /api/oauth/google/login
 */
export function GoogleOAuthButton() {
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
    const target = new URL("/api/oauth/google/login", window.location.origin);
    if (safeRedirect) {
      target.searchParams.set("redirect", safeRedirect);
    }
    window.location.href = target.toString();
  };

  return (
    <Button
      onClick={handleGoogleLogin}
      variant="outline"
      className="w-full gap-2 border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-900"
    >
      <Chrome className="h-5 w-5" />
      Entrar com Google
    </Button>
  );
}
