const MAX_PHASE_HISTORY = 25;

declare global {
  interface Window {
    __NEXO_BOOT_PHASE__?: string;
    __NEXO_LAST_PHASE__?: string;
    __NEXO_PHASE_HISTORY__?: string[];
  }
}

export function getBootPhase() {
  if (typeof window === "undefined") return "SSR";
  return window.__NEXO_BOOT_PHASE__ ?? "UNKNOWN";
}

export function getLastPhase() {
  if (typeof window === "undefined") return "SSR";
  return window.__NEXO_LAST_PHASE__ ?? "UNKNOWN";
}

export function getPhaseHistory() {
  if (typeof window === "undefined") return [];
  return [...(window.__NEXO_PHASE_HISTORY__ ?? [])];
}

export function setBootPhase(phase: string) {
  if (typeof window === "undefined") return;

  window.__NEXO_BOOT_PHASE__ = phase;
  window.__NEXO_LAST_PHASE__ = phase;

  const nextHistory = [...(window.__NEXO_PHASE_HISTORY__ ?? []), `${new Date().toISOString()} :: ${phase}`];
  window.__NEXO_PHASE_HISTORY__ = nextHistory.slice(-MAX_PHASE_HISTORY);
}
