import type { ReactNode } from 'react'

type CardVariant = 'default' | 'panel' | 'clickable'

type CardProps = {
  children: ReactNode
  className?: string
  variant?: CardVariant
  onClick?: () => void
  header?: ReactNode
  right?: ReactNode
  actions?: ReactNode
}

export default function Card({
  children,
  className = '',
  variant = 'default',
  onClick,
  header,
  right,
  actions,
}: CardProps) {
  const base =
    `
    relative
    rounded-2xl
    border border-white/10
    backdrop-blur-xl
    transition
  `

  const variants: Record<CardVariant, string> = {
    default: `
      bg-white/[0.06]
      shadow-[0_8px_30px_rgba(0,0,0,0.35)]
      hover:bg-white/[0.08]
    `,
    panel: `
      bg-white/[0.04]
      hover:bg-white/[0.06]
    `,
    clickable: `
      bg-white/[0.06]
      hover:bg-white/[0.1]
      cursor-pointer
    `,
  }

  const padding = 'p-6'

  return (
    <div
      onClick={onClick}
      className={`${base} ${variants[variant]} ${padding} ${className}`}
    >
      {(header || right) && (
        <div className="flex items-center justify-between mb-4">
          <div className="font-medium text-sm">
            {header}
          </div>
          {right}
        </div>
      )}

      <div>{children}</div>

      {actions && (
        <div className="mt-4 flex justify-end gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
