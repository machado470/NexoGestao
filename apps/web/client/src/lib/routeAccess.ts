export const AUTH_PATH_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/",
] as const;

export const MARKETING_PATHS = new Set([
  "/",
  "/about",
  "/sobre",
  "/produto",
  "/precos",
  "/contato",
  "/funcionalidades",
  "/privacy",
  "/privacidade",
  "/terms",
  "/termos",
]);

export function extractPathname(location: string): string {
  return location.split(/[?#]/, 1)[0] || "/";
}

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

export function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATHS.has(pathname);
}

export function isPublicOrAuthPath(pathname: string): boolean {
  return pathname === "/" || isMarketingPath(pathname) || isAuthPath(pathname);
}

export function shouldBootstrapSessionForPath(pathname: string): boolean {
  return pathname === "/" || isAuthPath(pathname) || !isMarketingPath(pathname);
}
