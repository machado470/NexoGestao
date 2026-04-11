import * as React from "react";
import { cn } from "@/lib/utils";

export function AppCard({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("app-card", className)} {...props} />;
}

export function PublicCard({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("public-card", className)} {...props} />;
}

export function AuthCard({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("auth-card", className)} {...props} />;
}
