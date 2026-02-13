import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/base/PageHeader'
import Card from '../../components/base/Card'
import SectionBase from '../../components/layout/SectionBase'
import { useTheme } from '../../theme/useTheme'

export default function AdminOnboarding() {
  const { styles } = useTheme()
  const navigate = useNavigate()

  return (
    <SectionBase>
      <PageHeader
        title="Onboarding institucional"
        description="Primeiros passos para ativar a governança"
      />

      <Card className="mt-8 space-y-6 max-w-xl">
        <p className={`text-sm ${styles.textMuted}`}>
          Para que o sistema produza efeito real, é necessário:
        </p>

        <ul className="list-disc list-inside text-sm space-y-2">
          <li>Cadastrar pessoas</li>
          <li>Criar trilhas</li>
          <li>Publicar trilhas</li>
        </ul>

        <button
          onClick={() => navigate('/admin/pessoas')}
          className={`w-full px-6 py-3 rounded ${styles.buttonPrimary}`}
        >
          Iniciar configuração
        </button>
      </Card>
    </SectionBase>
  )
}
