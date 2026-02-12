import { useMe } from '../hooks/useMe'

export default function OperationStatus() {
  const { me, loading } = useMe()

  if (loading || !me?.operationalState) {
    return null
  }

  const operational = me.operationalState

  const config = {
    NORMAL: {
      tone: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      title: 'Sistema sob controle',
      description:
        'Nenhum risco operacional ativo no momento.',
    },
    WARNING: {
      tone: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      title: 'Atenção requerida',
      description:
        operational.message ??
        'Há riscos que exigem acompanhamento.',
    },
    RESTRICTED: {
      tone: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      title: 'Operação sob restrição',
      description:
        operational.message ??
        'Ações corretivas pendentes bloqueiam operações.',
    },
    SUSPENDED: {
      tone: 'bg-rose-600/15 text-rose-300 border-rose-600/30',
      title: 'Operação suspensa',
      description:
        operational.message ??
        'A operação foi suspensa por risco crítico.',
    },
  } as const

  const current = config[operational.state]

  return (
    <div
      className={`
        mb-6
        rounded-lg border
        px-4 py-3
        flex items-start gap-3
        ${current.tone}
      `}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5"
      >
        <path d="M12 3l8 4v5c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z" />
      </svg>

      <div className="flex-1">
        <div className="text-sm font-semibold">
          {current.title}
        </div>

        <div className="text-sm opacity-80 mt-0.5">
          {current.description}
        </div>
      </div>
    </div>
  )
}
