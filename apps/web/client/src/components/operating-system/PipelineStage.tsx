export function PipelineStage({
  stages,
}: {
  stages: Array<{ label: string; value: number }>;
}) {
  return (
    <div className="rounded-xl border p-4">
      <h3 className="text-sm font-semibold">Pipeline operacional</h3>
      <div className="mt-3 grid gap-2 md:grid-cols-5">
        {stages.map(stage => (
          <div key={stage.label} className="rounded-lg border p-2 text-center">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">{stage.label}</p>
            <p className="text-lg font-semibold">{stage.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
