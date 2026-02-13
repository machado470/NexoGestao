import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import CollaboratorShell from '../../layouts/CollaboratorShell'
import PageHeader from '../../components/base/PageHeader'
import Card from '../../components/base/Card'

import { getMe } from '../../services/me'
import { submitAssessment } from '../../services/assessments'
import { useTheme } from '../../theme/useTheme'

type Assignment = {
  id: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  track: {
    title: string
  }
}

type MeResponse = {
  assignments: Assignment[]
}

export default function AssessmentPage() {
  const { styles } = useTheme()
  const { assignmentId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [score, setScore] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!assignmentId) {
      navigate('/app', { replace: true })
      return
    }

    getMe()
      .then((data: MeResponse) => {
        const found = data.assignments.find(a => a.id === assignmentId)

        if (!found || found.status !== 'IN_PROGRESS') {
          navigate('/app', { replace: true })
          return
        }

        setAssignment(found)
      })
      .finally(() => setLoading(false))
  }, [assignmentId, navigate])

  async function handleSubmit() {
    if (!assignment) return
    if (score < 0 || score > 100) return

    setSubmitting(true)

    await submitAssessment({
      assignmentId: assignment.id,
      score,
    })

    navigate('/app', { replace: true })
  }

  if (loading || !assignment) {
    return (
      <CollaboratorShell>
        <p className={`text-sm ${styles.textMuted}`}>Carregando…</p>
      </CollaboratorShell>
    )
  }

  return (
    <CollaboratorShell>
      <PageHeader
        title="Avaliação obrigatória"
        description={`Trilha: ${assignment.track.title}`}
      />

      <Card>
        <div className="space-y-4">
          <p className="text-sm opacity-70">
            Informe sua pontuação final (0 a 100).
          </p>

          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={e => setScore(Number(e.target.value))}
            className="w-full px-3 py-2 rounded bg-white/10 border border-white/20"
          />

          <button
            disabled={submitting}
            onClick={handleSubmit}
            className={`w-full py-2 rounded disabled:opacity-50 ${styles.buttonPrimary}`}
          >
            {submitting ? 'Enviando…' : 'Enviar avaliação'}
          </button>
        </div>
      </Card>
    </CollaboratorShell>
  )
}
