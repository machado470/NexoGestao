import type { ReactNode } from "react";
import { useLocation } from "wouter";
import ErrorBoundary from "./ErrorBoundary";

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary routeContext={location}>{children}</ErrorBoundary>;
}
