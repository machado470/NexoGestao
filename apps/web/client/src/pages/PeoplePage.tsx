import React from "react";
import { trpc } from "@/lib/trpc";

export default function PeoplePage() {
  const listPeople = trpc.people.list.useQuery();

  const people = (listPeople.data as any[]) ?? [];

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Pessoas</h1>

      <div className="rounded-2xl border p-4 dark:border-zinc-800">
        {listPeople.isLoading ? (
          <div>Carregando...</div>
        ) : (
          <div className="space-y-2">
            {people.length === 0 ? <div>Nenhuma pessoa.</div> : null}
            {people.map((p: any) => (
              <div
                key={p.id ?? p.name}
                className="flex items-center justify-between rounded-xl border p-3 dark:border-zinc-800"
              >
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm opacity-70">{p.role ?? ""}</div>
                </div>
                <div className="text-sm opacity-70">{p.operationalState ?? ""}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
