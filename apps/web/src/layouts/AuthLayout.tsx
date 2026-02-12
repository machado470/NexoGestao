import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export default function AuthLayout({ children }: Props) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div className="
        hidden
        lg:flex
        flex-col
        justify-center
        px-20
        bg-gradient-to-br
        from-blue-900
        via-blue-800
        to-blue-700
        text-white
      ">
        <h1 className="text-4xl font-semibold tracking-tight mb-6">
          JurisFlow
        </h1>

        <p className="text-lg opacity-90 mb-8 max-w-md">
          Controle risco jurídico com dados,
          trilhas e ações corretivas reais.
        </p>

        <ul className="space-y-3 text-sm opacity-80">
          <li>• Conformidade mensurável</li>
          <li>• Ações corretivas auditáveis</li>
          <li>• Risco em tempo real</li>
        </ul>
      </div>

      <div className="
        flex
        items-center
        justify-center
        px-6
        bg-[var(--bg)]
      ">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}
