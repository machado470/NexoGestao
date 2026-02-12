import PageHeader from '../../components/base/PageHeader'
import Card from '../../components/base/Card'
import useAssessment from '../../hooks/useAssessment'

export default function Assessment() {
  const { submitAssessment, loading } = useAssessment()

  return (
    <div className="space-y-8">
      <PageHeader
        title="Avaliação"
        description="Responda com atenção. Esta avaliação impacta seu risco."
      />

      <Card>
        <button
          onClick={() =>
            submitAssessment({
              assignmentId: 'manual',
              score: 100,
            })
          }
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 transition disabled:opacity-50"
        >
          {loading ? 'Enviando…' : 'Enviar avaliação'}
        </button>
      </Card>
    </div>
  )
}
