import type { ReactNode } from "react";
import { useLocation } from "wouter";

export function PublicLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info("[LAYOUT] PublicLayout mounted", { pathname: location, hasChildren: Boolean(children) });
  }
  return (
    <div className="nexo-public min-h-screen">
      {children}
    </div>
  );
}
