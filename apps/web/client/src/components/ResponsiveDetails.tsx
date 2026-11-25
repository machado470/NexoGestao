import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";

/**
 * Secondary controls stay visible on desktop and expand on demand on phones.
 *
 * Desktop renders a `display: contents` wrapper so the children become items
 * of the parent flex/grid layout. A `<details>` cannot do that: browsers wrap
 * its content in a `::details-content` box that stays `display: block` even
 * when the element itself is `display: contents`, which stacked every filter
 * in one column.
 */
export function ResponsiveDetails({
  title,
  children,
  controls = false,
}: {
  title: string;
  children: ReactNode;
  controls?: boolean;
}) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <div className="contents" data-responsive-details={title}>
        {children}
      </div>
    );
  }

  return (
    <details
      className={
        controls
          ? "group min-w-0 w-full"
          : "group min-w-0 rounded-xl border border-[var(--border-subtle)] p-3"
      }
      data-responsive-details={title}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-[var(--text-secondary)] motion-safe:transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="mt-2 grid min-w-0 gap-3">{children}</div>
    </details>
  );
}
