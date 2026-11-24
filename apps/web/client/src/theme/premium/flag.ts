import { useEffect } from "react";

/**
 * Premium skin feature flag — OFF by default.
 *
 * On only when:
 *  - the build sets VITE_PREMIUM_SKIN=true (not set in any environment today), or
 *  - in development (`vite dev`), localStorage "nexo:premium-skin" is "on".
 * Production builds ignore localStorage, so users cannot turn it on.
 */
export const PREMIUM_SKIN_STORAGE_KEY = "nexo:premium-skin";
export const PREMIUM_SKIN_ATTRIBUTE = "premium";

type FlagEnv = { DEV?: boolean; VITE_PREMIUM_SKIN?: string };
type FlagStorage = Pick<Storage, "getItem"> | null | undefined;

function defaultStorage(): FlagStorage {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function isPremiumSkinEnabled(
  env: FlagEnv = import.meta.env as FlagEnv,
  storage: FlagStorage = defaultStorage()
): boolean {
  if (env.VITE_PREMIUM_SKIN === "true") return true;
  if (!env.DEV) return false;
  try {
    return storage?.getItem(PREMIUM_SKIN_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

/** `data-skin` value for the app shell; undefined keeps today's DOM untouched. */
export function premiumSkinAttribute(enabled: boolean) {
  return enabled ? PREMIUM_SKIN_ATTRIBUTE : undefined;
}

/**
 * Mirrors the skin on <html> while the app shell is mounted, so dialogs and
 * popovers rendered in portals get the same tokens. Removed on unmount, so
 * public pages (landing, login) never see it.
 */
export function useDocumentPremiumSkin(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.dataset.skin = PREMIUM_SKIN_ATTRIBUTE;
    return () => {
      delete root.dataset.skin;
    };
  }, [enabled]);
}
