type ActionBoxProps = {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}

export default function ActionBox({
  title,
  description,
  actionLabel,
  onAction,
}: ActionBoxProps) {
  return (
    <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 space-y-2">
      <div className="font-semibold text-amber-500">
        {title}
      </div>

      <div className="text-sm opacity-70">
        {description}
      </div>

      <button
        onClick={onAction}
        className="mt-2 rounded bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400"
      >
        {actionLabel}
      </button>
    </div>
  )
}
