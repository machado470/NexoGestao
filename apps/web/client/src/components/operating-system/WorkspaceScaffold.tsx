import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function WorkspaceScaffold({
  title,
  subtitle,
  primaryAction,
  context,
  timeline,
  finance,
  communication,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  primaryAction?: { label: string; onClick: () => void };
  context: ReactNode;
  timeline?: ReactNode;
  finance?: ReactNode;
  communication?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "nexo-card-kpi space-y-4 rounded-2xl border border-[var(--border-subtle)]/85 p-4 md:p-5",
        className
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-subtle)]/60 pb-3.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {primaryAction ? (
          <Button size="sm" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
        ) : null}
      </header>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7">{context}</div>
        <aside className="space-y-4 xl:col-span-5">
          {timeline}
          {communication}
          {finance}
        </aside>
      </div>

      {children ? <footer className="pt-1">{children}</footer> : null}
    </section>
  );
}
