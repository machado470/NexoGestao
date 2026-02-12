type Props = {
  value: number
}

export default function ProgressBar({ value }: Props) {
  const clamped = Math.max(0, Math.min(100, value))

  function barColor() {
    if (clamped < 30) return 'bg-red-500'
    if (clamped < 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
      <div
        className={`h-full transition-all ${barColor()}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
