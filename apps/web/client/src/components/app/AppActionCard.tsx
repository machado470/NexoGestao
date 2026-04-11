import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppActionCard({
  title,
  description,
  onClick,
  children,
  className,
}: {
  title: string;
  description?: string;
  onClick: () => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn("nexo-card-panel cursor-pointer p-4", className)}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <p className="text-xs font-medium text-[var(--text-secondary)]">{title}</p>
      {description ? <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p> : null}
      {children ? <div className="mt-3 flex items-center justify-between gap-2">{children}</div> : null}
    </article>
  );
}
