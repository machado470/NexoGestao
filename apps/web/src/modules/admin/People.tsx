import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import Card from '../../components/base/Card'
import PageHeader from '../../components/base/PageHeader'
import StatusBadge from '../../components/base/StatusBadge'
import EmptyState from '../../components/base/EmptyState'
import { usePersons } from '../../hooks/usePersons'

type Risk = 'CRITICAL' | 'WARNING' | 'OK' | 'ALL'

const LS_RISK_FILTER = 'admin.people.riskFilter'

function riskFromPerson(p: any): Exclude<Risk, 'ALL'> {
  if (!p.active) return 'WARNING'
  return p.__risk ?? 'OK'
}

function riskWeight(r: Exclude<Risk, 'ALL'>) {
  return r === 'CRITICAL' ? 3 : r === 'WARNING' ? 2 : 1
}

function riskTone(r: Exclude<Risk, 'ALL'>) {
  return r === 'CRITICAL'
    ? 'critical'
    : r === 'WARNING'
    ? 'warning'
    : 'success'
}

function riskLabel(r: Risk) {
  if (r === 'CRITICAL') return 'Crítico'
  if (r === 'WARNING') return 'Atenção'
  if (r === 'OK') return 'OK'
  return 'Todos'
}

function riskSummary(p: any, r: Exclude<Risk, 'ALL'>) {
  if (!p.active) return 'Pessoa inativa'
  if (r === 'CRITICAL') return 'Risco elevado'
  if (r === 'WARNING') return 'Requer atenção'
  return 'Sem pendências'
}

export default function People() {
  const { data, loading } = usePersons()
  const navigate = useNavigate()

  const [filter, setFilter] = useState<Risk>(() => {
    try {
      const raw = localStorage.getItem(LS_RISK_FILTER)
      if (
        raw === 'CRITICAL' ||
        raw === 'WARNING' ||
        raw === 'OK' ||
        raw === 'ALL'
      )
        return raw
      return 'ALL'
    } catch {
      return 'ALL'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(LS_RISK_FILTER, filter)
    } catch {}
  }, [filter])

  const ordered = useMemo(() => {
    if (!data) return []

    const enriched = data.map(p => {
      const risk = riskFromPerson(p)
      return { ...p, __risk: risk }
    })

    const filtered =
      filter === 'ALL'
        ? enriched
        : enriched.filter(p => p.__risk === filter)

    return filtered.sort(
      (a, b) => riskWeight(b.__risk) - riskWeight(a.__risk),
    )
  }, [data, filter])

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pessoas (Risco)"
        description="Visão consolidada de risco humano."
      />

      {/* FILTROS */}
      <div className="flex items-center gap-2">
        {(['ALL', 'CRITICAL', 'WARNING', 'OK'] as Risk[]).map(r => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`
              text-xs px-3 py-1 rounded transition
              ${
                filter === r
                  ? 'bg-white/20'
                  : 'bg-white/10 hover:bg-white/20'
              }
            `}
          >
            {riskLabel(r)}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="text-sm opacity-60">
            Carregando pessoas…
          </div>
        ) : ordered.length === 0 ? (
          <EmptyState
            title="Nenhuma pessoa encontrada"
            description="Ajuste o filtro ou cadastre uma nova pessoa."
            action={
              <button
                onClick={() => navigate('/admin/people/new')}
                className="text-blue-400 hover:underline text-sm"
              >
                Criar pessoa
              </button>
            }
          />
        ) : (
          <div className="space-y-2">
            {ordered.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/admin/people/${p.id}`)}
                className="
                  w-full text-left
                  flex items-center justify-between gap-4
                  p-3 rounded-lg
                  hover:bg-slate-50 transition
                "
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {p.name}
                  </div>
                  <div className="text-xs opacity-70 truncate">
                    {p.email}
                  </div>
                  <div className="text-xs opacity-60 mt-1">
                    {riskSummary(p, p.__risk)}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge
                    label={riskLabel(p.__risk)}
                    tone={riskTone(p.__risk)}
                  />
                  <StatusBadge
                    label={p.role}
                    tone={
                      p.role === 'ADMIN'
                        ? 'critical'
                        : 'success'
                    }
                  />
                  {!p.active && (
                    <StatusBadge
                      label="Inativo"
                      tone="warning"
                    />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
