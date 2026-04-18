import type { ReactNode } from "react";
import { AppSectionCard } from "@/components/app-system";
import { cn } from "@/lib/utils";

type OperationalTopCardProps = {
  contextLabel?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  chips?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  className?: string;
};

export function OperationalTopCard({
  contextLabel = "Direção operacional",
  title,
  description,
  chips,
  primaryAction,
  secondaryActions,
  className,
}: OperationalTopCardProps) {
  return (
    <AppSectionCard className={cn(className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div>
            {contextLabel ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {contextLabel}
              </p>
            ) : null}
            <p className="mt-1 text-base font-semibold text-[var(--text-primary)]">
              {title}
            </p>
            {description ? (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {description}
              </p>
            ) : null}
          </div>
          {chips ? <div className="flex flex-wrap gap-2">{chips}</div> : null}
        </div>

        {(secondaryActions || primaryAction) ? (
          <div className="flex w-full flex-wrap items-center justify-start gap-2 lg:w-auto lg:justify-end">
            {secondaryActions}
            {primaryAction}
          </div>
        ) : null}
      </div>
    </AppSectionCard>
  );
}
