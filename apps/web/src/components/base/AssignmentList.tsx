import { useNavigate } from 'react-router-dom'

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

  return (
    <div className="space-y-4">
      {assignments.map(a => (
        <div
          key={a.id}
          className="bg-slate-900 rounded p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">
                {a.track.title}
              </div>
              <div className="text-xs text-slate-400">
                Progresso: {a.progress}%
              </div>
            </div>

            <button
              className="text-sm bg-blue-600 px-3 py-1 rounded"
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
