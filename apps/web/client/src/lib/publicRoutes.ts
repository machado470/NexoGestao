const PUBLIC_PATHS = new Set<string>([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/accept-invite",
  "/auth/callback",
  "/auth/confirm-email",
  "/about",
  "/sobre",
  "/produto",
  "/funcionalidades",
  "/precos",
  "/contato",
  "/privacy",
  "/privacidade",
  "/terms",
  "/termos",
]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

export const publicPathList = Array.from(PUBLIC_PATHS);
