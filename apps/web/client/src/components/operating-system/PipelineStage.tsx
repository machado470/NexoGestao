export function PipelineStage({
  stages,
  selectedStage,
  onStageSelect,
}: {
  stages: Array<{ label: string; value: number }>;
  selectedStage?: string | null;
  onStageSelect?: (stage: string | null) => void;
}) {
  const bottleneckValue = stages.length > 0 ? Math.max(...stages.map(s => s.value)) : 0;
  return (
    <div className="rounded-xl border p-4">
      <h3 className="text-sm font-semibold">Pipeline operacional</h3>
      <div className="mt-3 grid gap-2 md:grid-cols-5">
        {stages.map(stage => (
          <button
            key={stage.label}
            type="button"
            onClick={() => onStageSelect?.(selectedStage === stage.label ? null : stage.label)}
            className={`rounded-lg border p-2 text-center transition ${selectedStage === stage.label ? "border-orange-400 ring-2 ring-orange-200 dark:ring-orange-900/40" : ""} ${stage.value === bottleneckValue && bottleneckValue > 0 ? "border-red-300 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20" : ""}`}
          >
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{stage.label}</p>
            <p className="text-lg font-semibold">{stage.value}</p>
            {stage.value === bottleneckValue && bottleneckValue > 0 ? (
              <p className="text-[10px] uppercase tracking-wide text-red-600 dark:text-red-300">Gargalo</p>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
