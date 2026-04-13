import type { ReactNode } from "react";
import { useLocation } from "wouter";

export function AuthLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const renderAudit =
    typeof window !== "undefined" &&
    (new URLSearchParams(window.location.search).get("renderAudit") === "1" ||
      new URLSearchParams(window.location.search).has("renderAuditMode"));
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info("[LAYOUT] auth", { pathname: location, hasChildren: Boolean(children) });
  }
  return (
    <div className="nexo-auth min-h-screen">
      {renderAudit ? (
        <div style={{ position: "fixed", left: 8, bottom: 56, zIndex: 2147483645, background: "#7e22ce", color: "#f3e8ff", padding: "4px 8px", borderRadius: 6, font: "600 11px/1.2 system-ui" }}>
          LAYOUT: auth
        </div>
      ) : null}
      {children}
    </div>
  );
}
