import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/useMobile";
/** Secondary controls stay visible on desktop and expand on demand on phones. */
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
  return (
    <details
      open={!isMobile}
      className={
        controls
          ? "min-w-0 w-full md:contents"
          : "min-w-0 rounded-xl border border-[var(--border-subtle)] p-3 md:contents"
      }
    >
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold md:hidden">
        {title}
      </summary>
      <div className="grid min-w-0 gap-3 md:contents">{children}</div>
    </details>
  );
}
