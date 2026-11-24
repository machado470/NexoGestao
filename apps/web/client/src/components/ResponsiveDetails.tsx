import type { ReactNode } from "react";
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
          ? "min-w-0 w-full"
          : "min-w-0 rounded-xl border border-[var(--border-subtle)] p-3"
      }
      data-responsive-details={title}
    >
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
        {title}
      </summary>
      <div className="grid min-w-0 gap-3">{children}</div>
    </details>
  );
}
