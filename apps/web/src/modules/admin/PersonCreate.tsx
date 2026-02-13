import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/base/PageHeader'
import Card from '../../components/base/Card'
import SectionBase from '../../components/layout/SectionBase'
import { useTheme } from '../../theme/ThemeProvider'
import { createPerson } from '../../services/people'

export default function PersonCreate() {
  const { styles } = useTheme()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!name.trim()) return

    setSaving(true)
    setError(null)

    try {
      await createPerson({ name, department })
      navigate('/admin/pessoas')
    } catch {
      setError('Erro ao cadastrar pessoa')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionBase>
      <PageHeader title="Cadastrar pessoa" description="Entrada institucional" />

      <Card className="mt-6 max-w-xl space-y-4">
        <div>
          <label className={`text-sm ${styles.textMuted}`}>Nome</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full mt-1 rounded bg-white/10 border border-white/20 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className={`text-sm ${styles.textMuted}`}>Departamento</label>
          <input
            value={department}
            onChange={e => setDepartment(e.target.value)}
            className="w-full mt-1 rounded bg-white/10 border border-white/20 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <button
          disabled={saving}
          onClick={save}
          className={`rounded px-4 py-2 text-sm disabled:opacity-50 ${styles.buttonPrimary}`}
        >
          {saving ? 'Salvando…' : 'Cadastrar'}
        </button>
      </Card>
    </SectionBase>
  )
}
