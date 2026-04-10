import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  primaryAction?: ReactNode;
  breadcrumb?: Array<{ label: string; href?: string }>;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  primaryAction,
  breadcrumb,
  className,
}: PageHeaderProps) {
  return (
    <section className={cn("nexo-page-header px-1 py-1", className)}>
      <div className="relative z-10 space-y-2">
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-[var(--text-muted)] dark:text-[var(--text-muted)]">
            {breadcrumb.map((item, index) => (
              <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
                {index > 0 ? <ChevronRight className="h-3 w-3" /> : null}
                {item.href ? (
                  <a href={item.href} className="transition-colors hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-primary)]">
                    {item.label}
                  </a>
                ) : (
                  <span>{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}

        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="nexo-page-header-title">{title}</h1>
            {subtitle ? <p className="nexo-page-header-description">{subtitle}</p> : null}
          </div>
          {primaryAction ? <div className="flex items-center gap-2">{primaryAction}</div> : null}
        </div>
      </div>
    </section>
  );
}
