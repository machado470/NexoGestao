import { Link } from 'react-router-dom'
import PageHeader from '../../components/base/PageHeader'
import SectionBase from '../../components/layout/SectionBase'
import { useTheme } from '../../theme/ThemeProvider'

export default function People() {
  const { styles } = useTheme()

  return (
    <SectionBase>
      <PageHeader title="Pessoas" description="Gestão e cadastro de pessoas" />

      <div className="mt-6">
        <Link
          to="/admin/pessoas/nova"
          className={`text-sm underline ${styles.accent} hover:opacity-100 opacity-90`}
        >
          Cadastrar nova pessoa
        </Link>
      </div>
    </SectionBase>
  )
}
