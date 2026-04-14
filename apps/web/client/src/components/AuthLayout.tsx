import type { ReactNode } from "react";
import { useLocation } from "wouter";

export function AuthLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info("[LAYOUT] auth", { pathname: location, hasChildren: Boolean(children) });
  }
  return (
    <div className="nexo-auth min-h-screen">
      {children}
    </div>
  );
}
