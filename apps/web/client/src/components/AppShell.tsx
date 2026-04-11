import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  className,
  ...props
}: ComponentProps<"div"> & { children: ReactNode }) {
  return (
    <div className={cn("nexo-app", className)} {...props}>
      {children}
    </div>
  );
}
