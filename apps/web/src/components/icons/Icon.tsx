import type { LucideIcon } from 'lucide-react'

type Props = {
  icon: LucideIcon
  size?: number
  className?: string
}

export default function Icon({
  icon: IconComp,
  size = 18,
  className = '',
}: Props) {
  return (
    <IconComp
      size={size}
      className={`stroke-[1.75] opacity-60 ${className}`}
    />
  )
}
