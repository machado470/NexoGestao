import { toast } from "sonner";

export interface ConsentPreferences {
  marketing: boolean;
  analytics: boolean;
  cookies: true;
}

interface SaveConsentDependencies {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function saveConsent(
  prefs: ConsentPreferences,
  dependencies: SaveConsentDependencies = {}
) {
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
      console.error(`Falha ao registrar consentimento (status ${response.status})`, { prefs });
      toast.error("Não foi possível salvar seu consentimento. Tente novamente.");
      return false;
    }

    toast.success("Preferências de privacidade salvas com sucesso.");
    return true;
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const message = isTimeout
      ? "Tempo esgotado ao registrar consentimento."
      : "Erro ao registrar consentimento.";
    console.error(message, error);
    toast.error("Erro de rede ao salvar consentimento. Verifique sua conexão e tente novamente.");
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
