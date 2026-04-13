import type { ReactNode } from "react";
import { useLocation } from "wouter";

export function PublicLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const renderAudit =
    typeof window !== "undefined" &&
    (new URLSearchParams(window.location.search).get("renderAudit") === "1" ||
      new URLSearchParams(window.location.search).has("renderAuditMode"));
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info("[LAYOUT] public", { pathname: location, hasChildren: Boolean(children) });
  }
  return (
    <div className="nexo-public min-h-screen">
      {renderAudit ? (
        <div style={{ position: "fixed", left: 8, bottom: 40, zIndex: 2147483645, background: "#14532d", color: "#dcfce7", padding: "4px 8px", borderRadius: 6, font: "600 11px/1.2 system-ui" }}>
          LAYOUT: public
        </div>
      ) : null}
      {children}
    </div>
  );
}
