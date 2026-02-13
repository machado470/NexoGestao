import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageHeader from '../../components/base/PageHeader'
import Card from '../../components/base/Card'
import SectionBase from '../../components/layout/SectionBase'
import StatusBadge from '../../components/base/StatusBadge'
import { useTheme } from '../../theme/useTheme'
import { getPersonById } from '../../services/people'

type Person = {
  id: string
  name: string
  department?: string | null
  status: string
}

export default function PersonDetail() {
  const { styles } = useTheme()
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [person, setPerson] = useState<Person | null>(null)

  useEffect(() => {
    if (!id) return

    getPersonById(id)
      .then((data: Person) => setPerson(data))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <SectionBase>
        <p className={`text-sm ${styles.textMuted}`}>Carregando…</p>
      </SectionBase>
    )
  }

  if (!person) {
    return (
      <SectionBase>
        <p className="text-sm text-rose-400">Pessoa não encontrada.</p>
      </SectionBase>
    )
  }

  return (
    <SectionBase>
      <PageHeader title={person.name} description="Detalhe institucional da pessoa" />

      <Card className="mt-6 space-y-4">
        <div>
          <div className={`text-sm ${styles.textMuted}`}>Departamento</div>
          <div className="font-medium">{person.department ?? '—'}</div>
        </div>

        <div>
          <div className={`text-sm ${styles.textMuted}`}>Status</div>
          <StatusBadge label={person.status} tone="neutral" />
        </div>

        <div className="pt-4">
          <button
            onClick={() => navigate('/admin/pessoas')}
            className={`text-xs rounded px-3 py-1 disabled:opacity-40 ${styles.buttonPrimary}`}
          >
            Voltar
          </button>
        </div>
      </Card>
    </SectionBase>
  )
}
