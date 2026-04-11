import type { ReactNode } from "react";

export function PublicMarketingShell({ children }: { children: ReactNode }) {
  return <div className="nexo-public min-h-screen">{children}</div>;
}
