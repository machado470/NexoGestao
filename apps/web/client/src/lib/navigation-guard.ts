import { useBrowserLocation, navigate } from "wouter/use-browser-location";

const indexKey = "__nexoHistoryIndex";
let blocker: ((proceed: () => void) => void) | undefined;
let installed = false;
let currentIndex = 0;
let restoring: (() => void) | undefined;
let acceptedPop: number | undefined;

export function registerNavigationBlocker(
  handler: (proceed: () => void) => void
) {
  blocker = handler;
  return () => {
    if (blocker === handler) blocker = undefined;
  };
}

/** Use for actions that leave the page without calling the router (logout). */
export function requestAppNavigation(proceed: () => void) {
  if (restoring) return;
  if (blocker) blocker(proceed);
  else proceed();
}

function entryIndex(state: unknown): number | undefined {
  if (!state || typeof state !== "object") return undefined;
  const value = (state as Record<string, unknown>)[indexKey];
  return typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : undefined;
}

/** Install before router subscriptions, so a rejected pop never unmounts the form. */
export function installNavigationGuard() {
  if (installed) return;
  installed = true;
  currentIndex = entryIndex(history.state) ?? 0;
  history.replaceState({ ...history.state, [indexKey]: currentIndex }, "");
  window.addEventListener(
    "popstate",
    event => {
      const destination = entryIndex(event.state);
      // Cross-document history is protected by the form's native beforeunload.
      if (destination === undefined) return;
      if (restoring) {
        event.stopImmediatePropagation();
        if (destination !== currentIndex) {
          history.go(currentIndex - destination);
          return;
        }
        const restored = restoring;
        restoring = undefined;
        restored();
        return;
      }
      if (acceptedPop === destination) {
        acceptedPop = undefined;
        currentIndex = destination;
        return;
      }
      acceptedPop = undefined;
      if (blocker && destination !== currentIndex) {
        event.stopImmediatePropagation();
        const delta = destination - currentIndex;
        // Restore the real entry first; no duplicate entries or synthetic Back traps.
        restoring = () =>
          requestAppNavigation(() => {
            acceptedPop = destination;
            history.go(delta);
          });
        history.go(-delta);
        return;
      }
      currentIndex = destination;
    },
    { capture: true }
  );
}

const guardedNavigate: typeof navigate = (to, options) => {
  const url = new URL(to, window.location.href);
  if (url.href === window.location.href) return;
  requestAppNavigation(() => {
    const nextIndex = options?.replace ? currentIndex : currentIndex + 1;
    navigate(to, {
      ...options,
      state: { ...options?.state, [indexKey]: nextIndex },
    });
    currentIndex = nextIndex;
  });
};

export function useGuardedBrowserLocation(options?: { ssrPath?: string }) {
  const [path] = useBrowserLocation(options);
  return [path, guardedNavigate] as [string, typeof navigate];
}
