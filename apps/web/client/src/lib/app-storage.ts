const APP_STORAGE_PREFIXES = ["nexo:", "nexo.", "nexogestao_", "pilot-onboarding:"];

export function clearAppStorage() {
  if (typeof window === "undefined") return;
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[storageName];
      for (let i = storage.length - 1; i >= 0; i -= 1) {
        const key = storage.key(i);
        if (key && APP_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) {
          storage.removeItem(key);
        }
      }
    } catch (error) {
      console.error("[AUTH] clear storage failed", error);
    }
  }
}
