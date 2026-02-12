import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  actions?: ReactNode
  right?: ReactNode
}

export default function PageHeader({
  title,
  description,
  actions,
  right,
}: Props) {
  return (
    <header className="mb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            {title}
          </h1>

          {description && (
            <p className="mt-2 max-w-2xl text-sm md:text-base text-slate-400">
              {description}
            </p>
          )}
        </div>

        {(actions || right) && (
          <div className="flex items-center gap-3">
            {actions}
            {right}
          </div>
        )}
      </div>
    </header>
  )
}
