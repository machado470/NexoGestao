import { toast } from "sonner";
import { persistLocalConsent } from "./ConsentBanner.storage";

export interface ConsentPreferences {
  marketing: boolean;
  analytics: boolean;
  cookies: true;
}

interface SaveConsentDependencies {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  staticHosting?: boolean;
  persistLocalImpl?: typeof persistLocalConsent;
}

export async function saveConsent(
  prefs: ConsentPreferences,
  dependencies: SaveConsentDependencies = {}
) {
  const persistLocal = dependencies.persistLocalImpl ?? persistLocalConsent;
  const staticHosting =
    dependencies.staticHosting ??
    import.meta.env.VITE_STATIC_HOSTING === "true";

  const saveLocally = (successMessage: string) => {
    try {
      persistLocal(prefs);
      toast.success(successMessage);
      return true;
    } catch (error) {
      console.error("Falha ao salvar preferências neste navegador.", error);
      toast.error(
        "Não foi possível salvar as preferências neste navegador. Verifique se o armazenamento está permitido."
      );
      return false;
    }
  };

  // Static hosting has no consent API. Acknowledge only a successful local write.
  if (staticHosting) {
    return saveLocally("Preferências de privacidade salvas neste navegador.");
  }

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const timeoutMs = dependencies.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(
        `Falha ao registrar consentimento (status ${response.status})`,
        { prefs }
      );
      toast.error(
        "Não foi possível salvar seu consentimento. Tente novamente."
      );
      return false;
    }

    return saveLocally("Preferências de privacidade salvas com sucesso.");
  } catch (error) {
    const isTimeout =
      error instanceof DOMException && error.name === "AbortError";
    const message = isTimeout
      ? "Tempo esgotado ao registrar consentimento."
      : "Erro ao registrar consentimento.";
    console.error(message, error);
    toast.error(
      "Erro de rede ao salvar consentimento. Verifique sua conexão e tente novamente."
    );
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
