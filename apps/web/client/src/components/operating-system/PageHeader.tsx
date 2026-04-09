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
    <section className={cn("nexo-page-header", className)}>
      <div className="relative z-10 space-y-3">
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            {breadcrumb.map((item, index) => (
              <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
                {index > 0 ? <ChevronRight className="h-3 w-3" /> : null}
                {item.href ? (
                  <a href={item.href} className="transition-colors hover:text-zinc-700 dark:hover:text-zinc-200">
                    {item.label}
                  </a>
                ) : (
                  <span>{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
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
