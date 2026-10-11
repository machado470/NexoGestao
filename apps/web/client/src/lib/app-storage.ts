const APP_STORAGE_PREFIXES = ["nexo:", "nexo.", "nexogestao_", "pilot-onboarding:"];

export function clearAppStorage() {
  if (typeof window === "undefined") return;
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[storageName];
      // A ordem de Storage.key() pode mudar após uma remoção.
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
      for (const key of keys) {
        if (key && APP_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) {
          storage.removeItem(key);
        }
      }
    } catch (error) {
      console.error("[AUTH] clear storage failed", error);
    }
  }
}
