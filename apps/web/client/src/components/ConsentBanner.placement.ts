import { extractPathname, isPublicOrAuthPath } from "@/lib/routeAccess";

/**
 * Where the consent banner is rendered.
 *
 * - "inline": in the normal page flow at the top of the document. Used on public and auth pages
 *   (login, register, password recovery, invites, marketing) and on every narrow viewport, so the
 *   banner can never cover a form field or the submit button, including with the iOS virtual
 *   keyboard open or a reduced viewport height.
 * - "floating": a compact bottom-right card, only on internal pages of wide viewports, where the
 *   fixed sidebar makes an in-flow top bar impractical. Its height is reserved at the end of the
 *   page so content can always be scrolled clear of it.
 */
export type ConsentBannerPlacement = "inline" | "floating";

/**
 * Public pages outside the marketing/auth lists that also hold forms (customer approval and
 * acceptance links) or have no fixed sidebar (onboarding): always inline.
 */
export const CONSENT_INLINE_EXTRA_PREFIXES = ["/quote-approval", "/service-acceptance", "/onboarding"] as const;

/** Same breakpoint at which the internal layout switches to the fixed desktop sidebar. */
export const CONSENT_FLOATING_MIN_WIDTH_PX = 768;

export function resolveConsentBannerPlacement(params: {
  pathname: string;
  wideViewport: boolean;
}): ConsentBannerPlacement {
  if (!params.wideViewport) return "inline";
  const pathname = extractPathname(params.pathname || "/");
  if (isPublicOrAuthPath(pathname)) return "inline";
  if (CONSENT_INLINE_EXTRA_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return "inline";
  }
  return "floating";
}
