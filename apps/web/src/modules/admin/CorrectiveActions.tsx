import { useParams } from 'react-router-dom'
import { useState } from 'react'

import Card from '../../components/base/Card'
import PageHeader from '../../components/base/PageHeader'
import StatusBadge from '../../components/base/StatusBadge'
import ConfirmDialog from '../../components/base/ConfirmDialog'

import api from '../../services/api'
import { useCorrectiveActions } from '../../hooks/useCorrectiveActions'
import { usePersonDetail } from '../../hooks/usePersonDetail'
import { useMe } from '../../hooks/useMe'

export default function CorrectiveActions() {
  const { personId } = useParams<{ personId: string }>()
  const { me } = useMe()

  const { actions, loading, reload } =
    useCorrectiveActions(personId)

  const { loading: personLoading } =
    usePersonDetail(personId)

  const [confirm, setConfirm] = useState<
    null | { id: string }
  >(null)

  const [actionLoading, setActionLoading] =
    useState(false)

  const operationalState =
    me?.operationalState?.state ?? 'NORMAL'

  const blocked = operationalState !== 'NORMAL'

  if (loading || personLoading) {
    return (
      <div className="text-sm opacity-60">
        Carregando ações corretivas…
      </div>
    )
  }

  async function resolveAction(actionId: string) {
    if (!personId || blocked) return
    setActionLoading(true)

    try {
      await api.post(
        `/corrective-actions/${actionId}/resolve`,
      )

      await api.post(
        `/corrective-actions/person/${personId}/reassess`,
      )

      await reload()
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ações corretivas"
        description="Intervenções institucionais ativas"
      />

      {blocked && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">
                Ações bloqueadas
              </div>
              <div className="text-sm opacity-70 mt-1">
                Estado operacional atual:{' '}
                <strong>{operationalState}</strong>
              </div>
            </div>

            <StatusBadge
              label={operationalState}
              tone="warning"
            />
          </div>
        </Card>
      )}

      {actions.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-400">
            Nenhuma ação corretiva ativa.
          </div>
        </Card>
      ) : (
        actions.map(action => (
          <Card key={action.id}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">
                  Ação corretiva institucional
                </div>

                <div className="text-xs opacity-60 mt-1">
                  Criada em{' '}
                  {new Date(
                    action.createdAt,
                  ).toLocaleString()}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusBadge
                  label={action.status}
                  tone={
                    action.status === 'OPEN'
                      ? 'critical'
                      : action.status ===
                        'AWAITING_REASSESSMENT'
                      ? 'warning'
                      : 'success'
                  }
                />

                {action.status === 'OPEN' && (
                  <button
                    disabled={
                      actionLoading || blocked
                    }
                    onClick={() =>
                      setConfirm({
                        id: action.id,
                      })
                    }
                    className={`
                      text-sm px-4 py-2 rounded-lg
                      ${
                        blocked
                          ? 'bg-slate-600/10 text-slate-400 cursor-not-allowed'
                          : 'bg-emerald-500/10 text-emerald-400'
                      }
                    `}
                  >
                    Resolver
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))
      )}

      {confirm && (
        <ConfirmDialog
          title="Resolver ação corretiva"
          description="Esta ação exigirá reavaliação automática."
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            resolveAction(confirm.id)
          }
          loading={actionLoading}
        />
      )}
    </div>
  )
}
