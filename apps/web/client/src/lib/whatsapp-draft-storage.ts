export type WhatsAppDrafts = Record<string, string>;

export function whatsappDraftStorageKey(user: {
  id?: string;
  organizationId?: string;
} | null): string | null {
  if (!user?.id || !user.organizationId) return null;
  return `nexo:whatsapp:composer:v4:${encodeURIComponent(user.organizationId)}:${encodeURIComponent(user.id)}`;
}

export function readWhatsAppDrafts(key: string | null): WhatsAppDrafts {
  if (!key || typeof window === "undefined") return {};
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(([, draft]) => typeof draft === "string")
    );
  } catch {
    return {};
  }
}

export function persistWhatsAppDrafts(key: string | null, drafts: WhatsAppDrafts) {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(drafts));
  } catch {
    // O rascunho continua em memória quando o navegador bloqueia o armazenamento.
  }
}
