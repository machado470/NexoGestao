import React from "react";
import { trpc } from "@/lib/trpc";

export default function GovernancePage() {
  const governanceList = trpc.governance.governance.list.useQuery();
  const riskSummary = trpc.governance.governance.riskSummary.useQuery();
  const riskDistribution = trpc.governance.governance.riskDistribution.useQuery();
  const complianceDistribution = trpc.governance.governance.complianceDistribution.useQuery();

  const rows = (governanceList.data as any[]) ?? [];

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Governança</h1>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Risk Summary</div>
          <pre className="mt-2 overflow-auto text-xs">{JSON.stringify(riskSummary.data ?? {}, null, 2)}</pre>
        </div>
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Risk Distribution</div>
          <pre className="mt-2 overflow-auto text-xs">{JSON.stringify(riskDistribution.data ?? {}, null, 2)}</pre>
        </div>
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="text-sm opacity-70">Compliance Distribution</div>
          <pre className="mt-2 overflow-auto text-xs">{JSON.stringify(complianceDistribution.data ?? {}, null, 2)}</pre>
        </div>
      </div>

      <div className="rounded-2xl border p-4 dark:border-zinc-800">
        {governanceList.isLoading ? (
          <div>Carregando...</div>
        ) : (
          <div className="space-y-2">
            {rows.length === 0 ? <div>Nenhum item.</div> : null}
            {rows.map((g: any) => (
              <div key={g.id ?? `${g.type}-${g.createdAt}`} className="rounded-xl border p-3 dark:border-zinc-800">
                <div className="font-medium">{g.title ?? g.type ?? "Item"}</div>
                <div className="text-sm opacity-70">{g.createdAt ?? ""}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
