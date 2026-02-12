import { useNavigate } from 'react-router-dom'

import Card from '../../components/base/Card'
import PageHeader from '../../components/base/PageHeader'
import SectionBase from '../../components/layout/SectionBase'
import StatusBadge from '../../components/base/StatusBadge'

import { useExecutiveDashboard } from '../../hooks/useExecutiveDashboard'

type PersonStatus = 'OK' | 'WARNING' | 'CRITICAL'

function statusLabel(s: PersonStatus) {
  if (s === 'CRITICAL') return 'Crítico'
  if (s === 'WARNING') return 'Atenção'
  return 'OK'
}

function statusTone(s: PersonStatus) {
  if (s === 'CRITICAL') return 'critical'
  if (s === 'WARNING') return 'warning'
  return 'success'
}

export default function PeoplePage() {
  const navigate = useNavigate()
  const { loading, people } = useExecutiveDashboard()

  if (loading) {
    return (
      <SectionBase>
        <PageHeader
          title="Pessoas"
          description="Fila institucional de decisão."
        />
        <p className="mt-6 text-slate-400">
          Carregando pessoas…
        </p>
      </SectionBase>
    )
  }

  /**
   * 🔴 ESTADO VAZIO INSTITUCIONAL
   * Sem pessoas = sem governança
   */
  if (people.length === 0) {
    return (
      <SectionBase>
        <PageHeader
          title="Pessoas"
          description="Fila institucional de decisão."
        />

        <Card className="mt-10">
          <div className="space-y-4 max-w-xl">
            <div className="text-lg font-semibold">
              Nenhuma pessoa cadastrada
            </div>

            <p className="text-sm opacity-70">
              Sem pessoas, o sistema não consegue
              aplicar trilhas, avaliar risco ou
              exercer governança institucional.
            </p>

            <p className="text-sm opacity-70">
              Cadastre a primeira pessoa para
              iniciar o ciclo operacional.
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
      </SectionBase>
    )
  }

  // 🔥 PRIORIDADE INSTITUCIONAL
  const ordered = [...people].sort((a, b) => {
    const weight = (s: PersonStatus) =>
      s === 'CRITICAL' ? 3 : s === 'WARNING' ? 2 : 1

    return weight(b.status) - weight(a.status)
  })

  return (
    <SectionBase>
      <PageHeader
        title="Pessoas"
        description="Fila institucional de decisão."
      />

      <div className="space-y-3 mt-8">
        {ordered.map(p => (
          <Card
            key={p.id}
            variant="clickable"
            onClick={() =>
              navigate(`/admin/pessoas/${p.id}`)
            }
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-slate-400">
                  {p.department ?? '—'}
                </p>
              </div>

              <StatusBadge
                label={statusLabel(p.status)}
                tone={statusTone(p.status)}
              />
            </div>
          </Card>
        ))}
      </div>
    </SectionBase>
  )
}
