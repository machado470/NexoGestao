import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PageHeader from '../../components/base/PageHeader'
import Card from '../../components/base/Card'
import StatusBadge from '../../components/base/StatusBadge'

import CollaboratorShell from '../../layouts/CollaboratorShell'

import { getMe } from '../../services/me'
import { startAssignment } from '../../services/assignments'

type OperationalState = 'NORMAL' | 'RESTRICTED' | 'SUSPENDED'

type OperationalStatus = {
  state: OperationalState
  reason?: string
}

type Assignment = {
  id: string
  progress: number
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  track: {
    id: string
    title: string
  }
}

export default function CollaboratorDashboard() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [operational, setOperational] =
    useState<OperationalStatus>({ state: 'NORMAL' })

  async function load() {
    setLoading(true)
    const data = await getMe()
    setAssignments(data.assignments ?? [])
    setOperational(data.operational)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <CollaboratorShell>
        <p className="text-sm opacity-60">Carregando…</p>
      </CollaboratorShell>
    )
  }

  const canAct = operational.state === 'NORMAL'

  return (
    <CollaboratorShell>
      <PageHeader
        title="Meu painel"
        description="Suas trilhas e estado operacional"
      />

      {/* 🧠 ESTADO OPERACIONAL */}
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm opacity-60 block">
              Estado operacional
            </span>

            {operational.reason && (
              <span className="text-xs opacity-50">
                {operational.reason}
              </span>
            )}
          </div>

          <StatusBadge
            label={operational.state}
            tone={
              operational.state === 'NORMAL'
                ? 'success'
                : operational.state === 'RESTRICTED'
                ? 'warning'
                : 'critical'
            }
          />
        </div>
      </Card>

      {/* 🕒 ACESSO À TIMELINE */}
      <div className="mb-6">
        <button
          onClick={() =>
            navigate('/collaborator/timeline')
          }
          className="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Ver histórico de ações
        </button>
      </div>

      {/* 📚 TRILHAS */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold opacity-70">
          Trilhas atribuídas
        </h3>

        {assignments.length === 0 && (
          <p className="text-sm opacity-50">
            Nenhuma trilha atribuída no momento.
          </p>
        )}

        {assignments.map(a => (
          <Card key={a.id}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">
                {a.track.title}
              </span>
              <span className="text-xs opacity-60">
                {a.progress}%
              </span>
            </div>

            <div className="w-full h-2 bg-white/10 rounded overflow-hidden mb-3">
              <div
                className="h-2 bg-blue-400 transition-all"
                style={{ width: `${a.progress}%` }}
              />
            </div>

            {a.status === 'NOT_STARTED' && canAct && (
              <button
                onClick={async () => {
                  await startAssignment(a.id)
                  load()
                }}
                className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-500"
              >
                Iniciar trilha
              </button>
            )}

            {a.status === 'IN_PROGRESS' && canAct && (
              <button
                onClick={() =>
                  navigate(
                    `/collaborator/assessment/${a.id}`,
                  )
                }
                className="text-xs px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-500"
              >
                Realizar avaliação
              </button>
            )}

            {!canAct && (
              <p className="text-xs text-amber-400">
                Ações bloqueadas pelo estado operacional
              </p>
            )}

            {a.status === 'COMPLETED' && (
              <p className="text-xs text-green-400">
                Trilha concluída
              </p>
            )}
          </Card>
        ))}
      </div>
    </CollaboratorShell>
  )
}
