import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return <div className="nexo-auth min-h-screen">{children}</div>;
}
