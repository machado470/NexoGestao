import { useEffect, useRef } from "react";
import { Chrome } from "lucide-react";

interface GoogleSignInProps {
  onSuccess?: (credentialResponse: any) => void;
  onError?: () => void;
  text?: "signin_with" | "signup_with" | "signin" | "signup";
  size?: "large" | "medium" | "small";
  theme?: "outline" | "filled_blue" | "filled_black";
  width?: string;
  className?: string;
}

declare global {
  interface Window {
    google?: any;
  }
}

export function GoogleSignIn({
  onSuccess,
  onError,
  text = "signin_with",
  size = "large",
  theme = "outline",
  width = "100%",
  className = "",
}: GoogleSignInProps) {
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) {
      console.error("Google Client ID não configurado");
      return;
    }

    // Carregar Google Sign-In SDK
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: any) => {
            console.log('GSI credential response:', response);
            if (onSuccess) {
              onSuccess(response);
            }
          },
          use_fedcm_for_prompt: false,
        });

        if (googleButtonRef.current) {
          window.google.accounts.id.renderButton(googleButtonRef.current, {
            type: "standard",
            theme: theme,
            size: size,
            text: text,
            width: width,
            locale: "pt-BR",
          });
          

        }
        
        // One Tap prompt desabilitado para evitar erros FedCM
        // window.google.accounts.id.prompt((notification: any) => {
        //   console.log("One Tap notification:", notification);
        // });


      }
    };

    script.onerror = () => {
      console.error("Erro ao carregar Google Sign-In SDK");
      if (onError) {
        onError();
      }
    };

    document.body.appendChild(script);

    return () => {
      // Limpar script ao desmontar
      if (window.google?.accounts?.id?.cancel) {
        window.google.accounts.id.cancel();
      }
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [clientId, onSuccess, onError, text, size, theme, width]);

  if (!clientId) {
    return (
      <button
        disabled
        className="w-full px-4 py-2 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed opacity-50"
        title="Google Sign-In não configurado"
      >
        <div className="flex items-center justify-center gap-2">
          <Chrome className="w-5 h-5" />
          <span>Google não disponível</span>
        </div>
      </button>
    );
  }

  return (
    <div
      ref={googleButtonRef}
      className={`flex justify-center ${className}`}
      style={{ width }}
    />
  );
}
