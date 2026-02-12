import type { ReactNode } from 'react'

export default function FeatureCard({
  icon,
  eyebrow,
  title,
  children,
}: {
  icon: ReactNode
  eyebrow?: string
  title: string
  children: ReactNode
}) {
  return (
    <div
      className="
        group relative h-full
        rounded-2xl
        border border-white/10
        bg-white/[0.04]
        backdrop-blur-xl
        p-10
        transition-all duration-300
        hover:-translate-y-1
        hover:border-white/20
      "
    >
      <div
        className="
          pointer-events-none
          absolute inset-0
          rounded-2xl
          bg-[radial-gradient(circle_at_25%_15%,rgba(59,130,246,0.22),transparent_55%)]
          opacity-0
          group-hover:opacity-100
          transition-opacity duration-300
        "
      />

      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <div
            className="
              w-12 h-12
              text-blue-400
              transition-transform duration-300
              group-hover:scale-110
            "
          >
            {icon}
          </div>

          {eyebrow && (
            <span className="text-xs uppercase tracking-wider text-blue-300">
              {eyebrow}
            </span>
          )}
        </div>

        <h3 className="text-lg font-medium text-white">{title}</h3>

        <p className="text-sm text-slate-400 leading-relaxed">
          {children}
        </p>
      </div>
    </div>
  )
}
