import { useNavigate } from 'react-router-dom'

import Card from '../../components/base/Card'
import PageHeader from '../../components/base/PageHeader'
import StatusBadge from '../../components/base/StatusBadge'

import { useExecutiveDashboard } from '../../hooks/useExecutiveDashboard'

export default function AdminDashboard() {
  const navigate = useNavigate()

  const {
    loading,
    peopleStats,
    correctiveOpenCount,
    people,
  } = useExecutiveDashboard()

  if (loading) {
    return (
      <div className="text-sm opacity-60">
        Carregando visão executiva…
      </div>
    )
  }

  const totalPeople =
    peopleStats.OK +
    peopleStats.WARNING +
    peopleStats.CRITICAL

  /**
   * 🟡 ESTADO INICIAL INSTITUCIONAL
   */
  if (totalPeople === 0) {
    return (
      <div className="space-y-10">
        <PageHeader
          title="Visão Executiva"
          description="Inicialização institucional do sistema"
        />

        <Card>
          <div className="space-y-4 max-w-xl">
            <div className="text-lg font-semibold">
              Governança ainda não iniciada
            </div>

            <p className="text-sm opacity-70">
              Nenhuma pessoa está cadastrada.
              Sem pessoas, o sistema não executa
              trilhas, não avalia risco e não
              produz decisões institucionais.
            </p>

            <p className="text-sm opacity-70">
              O primeiro passo é cadastrar as
              pessoas da organização.
            </p>

            <div className="pt-2">
              <button
                onClick={() =>
                  navigate('/admin/pessoas/nova')
                }
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
              >
                Cadastrar primeira pessoa
              </button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const criticalCount = peopleStats.CRITICAL
  const warningCount = peopleStats.WARNING

  const executiveLabel =
    criticalCount > 0
      ? 'Risco crítico ativo'
      : warningCount > 0
      ? 'Risco sob monitoramento'
      : 'Operação sob controle'

  const executiveDescription =
    criticalCount > 0
      ? 'Existem pessoas em estado crítico exigindo decisão imediata.'
      : warningCount > 0
      ? 'Há riscos que exigem acompanhamento para evitar agravamento.'
      : 'Nenhum risco institucional relevante identificado no momento.'

  const executiveTone =
    criticalCount > 0
      ? 'critical'
      : warningCount > 0
      ? 'warning'
      : 'success'

  const criticalPeople = people.filter(
    p => p.status === 'CRITICAL',
  )

  return (
    <div className="space-y-10">
      <PageHeader
        title="Visão Executiva"
        description="Estado institucional atual e impactos operacionais"
      />

      {/* Situação institucional */}
      <Card>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm opacity-60">
              Situação atual
            </div>

            <div className="mt-1 text-lg font-semibold">
              {executiveLabel}
            </div>

            <div className="mt-2 text-sm opacity-70 max-w-xl">
              {executiveDescription}
            </div>
          </div>

          <StatusBadge
            label={
              criticalCount > 0
                ? 'CRÍTICO'
                : warningCount > 0
                ? 'ATENÇÃO'
                : 'OK'
            }
            tone={executiveTone}
          />
        </div>
      </Card>

      {/* Indicadores */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <div className="text-sm opacity-60">
            Pessoas OK
          </div>
          <div className="text-2xl font-semibold">
            {peopleStats.OK}
          </div>
        </Card>

        <Card>
          <div className="text-sm opacity-60">
            Atenção
          </div>
          <div className="text-2xl font-semibold">
            {warningCount}
          </div>
        </Card>

        <Card>
          <div className="text-sm opacity-60">
            Críticos
          </div>
          <div className="text-2xl font-semibold text-rose-400">
            {criticalCount}
          </div>
        </Card>

        <Card>
          <div className="text-sm opacity-60">
            Ações corretivas abertas
          </div>
          <div className="text-2xl font-semibold">
            {correctiveOpenCount}
          </div>
        </Card>
      </div>

      {/* Pessoas críticas */}
      <Card>
        <div className="font-medium mb-3">
          Pessoas em estado crítico
        </div>

        {criticalPeople.length === 0 ? (
          <p className="text-sm opacity-70">
            Nenhuma pessoa em estado crítico no
            momento.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {criticalPeople.map(p => (
              <li
                key={p.id}
                className="flex items-center justify-between"
              >
                <span>{p.name}</span>

                <button
                  onClick={() =>
                    navigate(`/admin/pessoas/${p.id}`)
                  }
                  className="text-xs rounded bg-rose-600/10 px-3 py-1 text-rose-400"
                >
                  Ver pessoa
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
