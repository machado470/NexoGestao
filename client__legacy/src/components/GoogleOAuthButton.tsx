import { Button } from "@/components/ui/button";
import { Chrome } from "lucide-react";

/**
 * Botão de login com Google OAuth
 * Redireciona para /api/oauth/google/login
 */
export function GoogleOAuthButton() {
  const handleGoogleLogin = () => {
    window.location.href = "/api/oauth/google/login";
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
