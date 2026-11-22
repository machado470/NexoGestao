import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, type RefObject } from "react";
import { X } from "lucide-react";
import { Link, useLocation } from "wouter";

import { saveConsent, type ConsentPreferences } from "./ConsentBanner.logic";
import {
  CONSENT_FLOATING_MIN_WIDTH_PX,
  resolveConsentBannerPlacement,
} from "./ConsentBanner.placement";
import { readStoredConsent } from "./ConsentBanner.storage";

function useMinWidth(px: number) {
  const query = `(min-width: ${px}px)`;
  const read = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/**
 * While the floating card is shown, reserve its height at the end of the page so it can always be
 * scrolled clear of content. Restores the previous padding when hidden or unmounted.
 */
function useReservedBottomSpace(target: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const element = target.current;
    if (!active || !element || typeof document === "undefined") return;
    const body = document.body;
    const previous = body.style.paddingBottom;
    const apply = () => {
      const { top } = element.getBoundingClientRect();
      const reserved = Math.max(0, Math.ceil(window.innerHeight - top));
      body.style.paddingBottom = `${reserved}px`;
    };
    apply();
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(apply) : null;
    observer?.observe(element);
    window.addEventListener("resize", apply);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", apply);
      body.style.paddingBottom = previous;
    };
  }, [target, active]);
}

export function ConsentBanner() {
  const [location] = useLocation();
  const wideViewport = useMinWidth(CONSENT_FLOATING_MIN_WIDTH_PX);
  const placement = resolveConsentBannerPlacement({ pathname: location, wideViewport });
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    marketing: false,
    analytics: false,
    cookies: true,
  });

  useEffect(() => {
    const stored = readStoredConsent();
    if (stored?.preferences) {
      setPreferences(stored.preferences);
    }
    setIsVisible(!stored);
  }, []);

  const closeBanner = () => {
    setIsVisible(false);
    setIsCustomizing(false);
  };

  const recordConsents = async (prefs: ConsentPreferences) => {
    setIsSubmitting(true);

    try {
      return await saveConsent(prefs);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptAll = async () => {
    const ok = await recordConsents({
      marketing: true,
      analytics: true,
      cookies: true,
    });
    if (ok) closeBanner();
  };

  const handleCustomize = async () => {
    if (!isCustomizing) {
      setIsCustomizing(true);
      return;
    }

    const ok = await recordConsents(preferences);
    if (ok) closeBanner();
  };

  const handleRejectOptional = async () => {
    const ok = await recordConsents({
      marketing: false,
      analytics: false,
      cookies: true,
    });
    if (ok) closeBanner();
  };

  useReservedBottomSpace(cardRef, isVisible && placement === "floating");

  if (!isVisible) return null;

  const isInline = placement === "inline";

  // "inline": part of the normal page flow, at the top of the document. It never overlays the
  // page, so forms stay reachable whatever the viewport height, the virtual keyboard or scroll.
  // "floating": compact card in the bottom-right corner, only on wide internal pages, with its
  // height reserved at the end of the page.
  return (
    <section
      role="region"
      aria-label="Privacidade e cookies"
      data-consent-placement={placement}
      className={
        isInline
          ? "relative w-full border-b border-slate-200 bg-white px-4 pb-4 sm:px-5"
          : "pointer-events-none fixed right-4 z-50 w-[min(28rem,calc(100vw-2rem))]"
      }
      style={
        isInline
          ? { paddingTop: "max(1rem, env(safe-area-inset-top))" }
          : { bottom: "max(1rem, env(safe-area-inset-bottom))" }
      }
    >
      <div
        ref={cardRef}
        className={
          isInline
            ? "mx-auto max-w-4xl"
            : "pointer-events-auto rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_18px_42px_rgba(15,23,42,0.14)] backdrop-blur-sm"
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Privacidade e cookies
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">
              Usamos cookies essenciais para funcionamento da plataforma. Você
              pode aceitar categorias opcionais ou personalizar. Leia a nossa{" "}
              <Link
                href="/privacidade"
                className="font-medium text-orange-600 hover:text-orange-700"
              >
                Política de Privacidade
              </Link>
              .
            </p>
          </div>

          <button
            type="button"
            onClick={handleRejectOptional}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar banner de cookies"
          >
            <X className="size-4" />
          </button>
        </div>

        {isCustomizing ? (
          <div className={isInline ? "mt-4 grid gap-2 sm:grid-cols-3" : "mt-4 grid gap-2"}>
            <label className="rounded-xl border border-slate-200 bg-[var(--surface-base)] p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked
                disabled
                className="mr-2 align-middle"
              />
              Essenciais (obrigatório)
            </label>
            <label className="rounded-xl border border-slate-200 bg-[var(--surface-base)] p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={e =>
                  setPreferences({
                    ...preferences,
                    analytics: e.target.checked,
                  })
                }
                className="mr-2 align-middle"
              />
              Analytics e performance
            </label>
            <label className="rounded-xl border border-slate-200 bg-[var(--surface-base)] p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={preferences.marketing}
                onChange={e =>
                  setPreferences({
                    ...preferences,
                    marketing: e.target.checked,
                  })
                }
                className="mr-2 align-middle"
              />
              Marketing
            </label>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleRejectOptional}
            disabled={isSubmitting}
          >
            Somente essenciais
          </Button>
          <Button
            variant="outline"
            onClick={handleCustomize}
            disabled={isSubmitting}
          >
            {isCustomizing ? "Salvar preferências" : "Personalizar"}
          </Button>
          <Button
            onClick={handleAcceptAll}
            disabled={isSubmitting}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {isSubmitting ? "Salvando..." : "Aceitar tudo"}
          </Button>
        </div>
      </div>
    </section>
  );
}
