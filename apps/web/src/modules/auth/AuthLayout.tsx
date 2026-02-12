import type { ReactNode } from 'react'

export default function AuthLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="
      min-h-screen
      flex items-center justify-center
      bg-gradient-to-br
      from-[#0B1E33]
      via-[#081A2D]
      to-[#050F1C]
      px-6
    ">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center">
        <div className="hidden md:block text-slate-200">
          <h1 className="text-4xl font-semibold leading-tight">
            JurisFlow
          </h1>
          <p className="mt-4 text-slate-400 max-w-md">
            Governança de treinamento, risco humano e auditoria
            para escritórios jurídicos que operam com dados reais.
          </p>
        </div>

        <div className="
          bg-white/5
          backdrop-blur
          border border-white/10
          rounded-2xl
          p-8
        ">
          {children}
        </div>
      </div>
    </div>
  )
}
