import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../theme/ThemeProvider'

type Assignment = {
  id: string
  progress: number
  track: {
    id: string
    title: string
  }
}

export default function AssignmentList({
  assignments,
}: {
  assignments: Assignment[]
}) {
  const navigate = useNavigate()
  const { styles } = useTheme()

  return (
    <div className="space-y-4">
      {assignments.map(a => (
        <div key={a.id} className="bg-slate-900 rounded p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{a.track.title}</div>
              <div className="text-xs text-slate-400">
                Progresso: {a.progress}%
              </div>
            </div>

            <button
              className={`text-sm px-3 py-1 rounded ${styles.buttonPrimary}`}
              onClick={() =>
                navigate(`/collaborator/assessment/${a.id}`)
              }
            >
              Avaliar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

