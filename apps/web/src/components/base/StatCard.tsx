import Card from './Card'

type StatCardProps = {
  label: string
  value: string | number
  colorClass?: string
}

export default function StatCard({
  label,
  value,
  colorClass,
}: StatCardProps) {
  return (
    <Card>
      <div className="text-sm opacity-70">
        {label}
      </div>
      <div
        className={`mt-2 text-3xl font-semibold ${
          colorClass ?? ''
        }`}
      >
        {value}
      </div>
    </Card>
  )
}
