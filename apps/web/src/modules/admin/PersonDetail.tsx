import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'

import PageHeader from '../../components/base/PageHeader'
import Card from '../../components/base/Card'
import StatusBadge from '../../components/base/StatusBadge'

import { usePersonDetail } from '../../hooks/usePersonDetail'
import {
  listAssignmentsByPerson,
  startPersonAssignment,
  type PersonAssignment,
} from '../../services/personAssignments'

import {
  operationalLabel,
  operationalToExecutive,
  executiveTone,
  type OperationalState,
} from '../../utils/operationalStatus'

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>()

  const {
    person,
    audit,
    loading: personLoading,
  } = usePersonDetail(id!)

  const [assignments, setAssignments] =
    useState<PersonAssignment[]>([])
  const [loadingAssignments, setLoadingAssignments] =
    useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return

    listAssignmentsByPerson(id)
      .then(setAssignments)
      .finally(() => setLoadingAssignments(false))
  }, [id])

  if (personLoading) {
    return (
      <div className="text-sm opacity-60">
        Carregando pessoa…
      </div>
    )
  }

  if (!person) {
    return (
      <div className="text-sm opacity-60">
        Pessoa não encontrada.
      </div>
    )
  }

  const operational =
    person.operationalState as OperationalState

  const executiveStatus =
    operationalToExecutive(operational)

  const tone = executiveTone(executiveStatus)
  const label = operationalLabel(operational)

  const canExecute =
    operational !== 'SUSPENDED' &&
    operational !== 'RESTRICTED'

  const openAssignments = useMemo(
    () => assignments.filter(a => a.progress === 0),
    [assignments],
  )

  async function handleStartAssignment(
    assignmentId: string,
  ) {
    if (!id || !canExecute) return

    setBusy(true)
    await startPersonAssignment(assignmentId)
    const updated =
      await listAssignmentsByPerson(id)
    setAssignments(updated)
    setBusy(false)
  }

  return (
    <div className="space-y-8">
      {/* Estado operacional */}
      <Card>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm opacity-60">
              Estado operacional
            </div>

            <div className="mt-1 text-lg font-semibold">
              {label}
            </div>

            <div className="mt-2 text-sm opacity-70 max-w-xl">
              Este estado reflete o impacto das
              pendências atuais segundo as regras
              institucionais do sistema.
            </div>
          </div>

          <StatusBadge
            label={executiveStatus}
            tone={tone}
          />
        </div>
      </Card>

      <PageHeader
        title={person.name}
        description="Visão detalhada e decisões necessárias"
      />

      {/* Bloco de decisão */}
      <Card>
        <div className="font-medium mb-2">
          O que precisa ser feito agora
        </div>

        {!canExecute && (
          <p className="text-sm opacity-70">
            A pessoa está em regime restritivo.
            Apenas ações de regularização são
            permitidas.
          </p>
        )}

        {canExecute &&
          openAssignments.length === 0 && (
            <p className="text-sm opacity-70">
              Nenhuma ação imediata necessária no
              momento.
            </p>
          )}

        {canExecute &&
          openAssignments.length > 0 && (
            <p className="text-sm opacity-70">
              Existem atribuições pendentes que
              precisam ser iniciadas para reduzir
              risco operacional.
            </p>
          )}
      </Card>

      {/* Dados básicos */}
      <Card>
        <div className="space-y-2 text-sm">
          <div>Email: {person.email}</div>
          <div>
            Status de acesso:{' '}
            <StatusBadge
              label={
                person.active ? 'Ativo' : 'Inativo'
              }
              tone={
                person.active
                  ? 'success'
                  : 'warning'
              }
            />
          </div>
        </div>
      </Card>

      {/* Assignments */}
      <Card>
        <div className="font-medium mb-2">
          Atribuições
        </div>

        {loadingAssignments ? (
          <div className="text-sm opacity-60">
            Carregando atribuições…
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-sm opacity-60">
            Nenhuma atribuição vinculada.
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {assignments.map(a => (
              <li
                key={a.id}
                className="flex items-center justify-between"
              >
                <span>{a.track.title}</span>

                {a.progress === 0 ? (
                  <button
                    disabled={busy || !canExecute}
                    onClick={() =>
                      handleStartAssignment(a.id)
                    }
                    className="text-xs rounded bg-blue-600 px-2 py-1 text-white disabled:opacity-40"
                  >
                    Iniciar
                  </button>
                ) : (
                  <span className="opacity-60">
                    Progresso: {a.progress}%
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Auditoria */}
      <Card>
        <div className="font-medium mb-2">
          Auditoria
        </div>

        {audit.length === 0 ? (
          <div className="text-sm opacity-60">
            Nenhum evento registrado.
          </div>
        ) : (
          <ul className="text-sm space-y-1">
            {audit.map(e => (
              <li key={e.id}>
                {e.action} —{' '}
                {new Date(
                  e.createdAt,
                ).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
