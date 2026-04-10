import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type OperationalHeaderProps = {
  title?: ReactNode;
  description?: ReactNode;
  primaryAction?: ReactNode;
  priorities?: ReactNode;
  breadcrumb?: Array<{ label: string; href?: string }>;
  className?: string;
};

export function OperationalHeader({
  description,
  primaryAction,
  priorities,
  breadcrumb,
  className,
}: OperationalHeaderProps) {
  return (
    <section className={cn("px-1 py-0.5", className)}>
      <div className="relative z-10 space-y-2">
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-1 text-xs text-[var(--text-muted)]"
          >
            {breadcrumb.map((item, index) => (
              <span
                key={`${item.label}-${index}`}
                className="inline-flex items-center gap-1"
              >
                {index > 0 ? <ChevronRight className="h-3 w-3" /> : null}
                {item.href ? (
                  <a
                    href={item.href}
                    className="transition-colors hover:text-[var(--text-secondary)]"
                  >
                    {item.label}
                  </a>
                ) : (
                  <span>{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            {description ? (
              <p className="nexo-page-header-description">{description}</p>
            ) : null}
          </div>
          {primaryAction ? (
            <div className="flex items-center gap-2">{primaryAction}</div>
          ) : null}
        </div>

        {priorities ? (
          <div className="border-t border-[var(--border-soft)] pt-3">
            {priorities}
          </div>
        ) : null}
      </div>
    </section>
  );
}
