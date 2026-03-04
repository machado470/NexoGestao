import React from "react";
import { trpc } from "@/lib/trpc";

export default function NotificationBell() {
  // list() é void -> não manda input
  const governanceQuery = trpc.governance.governance.list.useQuery(undefined, { enabled: false });

  const items = (governanceQuery.data as any[]) ?? [];

  return (
    <button
      type="button"
      className="relative rounded-lg border px-3 py-2 dark:border-zinc-800"
      onClick={() => governanceQuery.refetch()}
      title="Governança"
    >
      <span>🔔</span>
      {items.length > 0 ? (
        <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
          {items.length}
        </span>
      ) : null}
    </button>
  );
}
