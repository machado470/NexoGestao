import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import PageHeader from '../../components/base/PageHeader'
import Card from '../../components/base/Card'
import SectionBase from '../../components/layout/SectionBase'

import { submitAssessment } from '../../services/assessments'

export default function EvaluationsPage() {
  const [searchParams] = useSearchParams()

  const prefilledAssignmentId =
    searchParams.get('assignmentId') ?? ''

  const [assignmentId, setAssignmentId] = useState('')
  const [score, setScore] = useState<number>(80)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (prefilledAssignmentId) {
      setAssignmentId(prefilledAssignmentId)
    }
  }, [prefilledAssignmentId])

  async function submit() {
    if (!assignmentId) {
      setError('Informe o ID da atribuição')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      await submitAssessment({
        assignmentId,
        score,
      })

      setSuccess('Avaliação registrada com sucesso')
      setAssignmentId('')
    } catch {
      setError('Erro ao registrar avaliação')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SectionBase>
      <PageHeader
        title="Avaliações"
        description="Registrar avaliação e impacto no risco"
      />

      <Card className="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="text-sm opacity-60">
              Assignment ID
            </label>
            <input
              value={assignmentId}
              onChange={e =>
                setAssignmentId(e.target.value)
              }
              className="w-full mt-1 rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm opacity-60">
              Score ({score})
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={score}
              onChange={e =>
                setScore(Number(e.target.value))
              }
              className="w-full"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">
              {error}
            </p>
          )}

          {success && (
            <p className="text-sm text-emerald-400">
              {success}
            </p>
          )}

          <button
            disabled={submitting}
            onClick={submit}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting
              ? 'Enviando…'
              : 'Registrar avaliação'}
          </button>
        </div>
      </Card>
    </SectionBase>
  )
}
