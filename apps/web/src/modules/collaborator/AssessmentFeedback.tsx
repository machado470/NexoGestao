import { useLocation, useNavigate } from 'react-router-dom'

export default function AssessmentFeedback() {
  const navigate = useNavigate()
  const location = useLocation() as any

  const feedback = location.state?.feedback

  if (!feedback) {
    return (
      <div className="text-slate-400">
        Nenhum feedback disponível.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">
        Resultado da Avaliação
      </h2>

      <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-3">
        <div className="text-sm text-slate-400">
          Nota obtida
        </div>
        <div className="text-3xl font-bold">
          {feedback.score}
        </div>

        <div className="mt-4 text-sm text-slate-400">
          Avaliação do sistema
        </div>
        <div className="text-base">
          {feedback.message}
        </div>

        <div className="mt-4 text-sm text-slate-400">
          Próximo passo
        </div>
        <div className="text-base font-medium">
          {feedback.nextStep}
        </div>
      </div>

      <button
        onClick={() => navigate('/collaborator')}
        className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-white"
      >
        Voltar ao painel
      </button>
    </div>
  )
}
