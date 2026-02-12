import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../services/api'

import PageHeader from '../../components/base/PageHeader'
import Card from '../../components/base/Card'
import ProgressBar from '../../components/base/ProgressBar'
import SectionBase from '../../components/layout/SectionBase'

type TrackItem = {
  id: string
  title: string
  content?: string | null
  type: 'READING' | 'ACTION' | 'CHECKPOINT'
  order: number
}

export default function AssignmentExecution() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [item, setItem] = useState<TrackItem | null>(null)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  async function loadNext() {
    if (!id) return

    const { data } = await api.get(
      `/assignments/${id}/next-item`,
    )

    if (!data) {
      navigate('/collaborator')
      return
    }

    setItem(data)
    setLoading(false)
  }

  async function start() {
    if (!id) return
    await api.post(`/assignments/${id}/start`)
    await loadNext()
  }

  async function completeItem() {
    if (!id || !item) return

    setBusy(true)

    const { data } = await api.post(
      `/assignments/${id}/complete-item`,
      { itemId: item.id },
    )

    setProgress(data.progress)
    setBusy(false)

    if (data.finished) {
      navigate('/collaborator')
    } else {
      await loadNext()
    }
  }

  useEffect(() => {
    start()
  }, [id])

  if (loading || !item) {
    return (
      <SectionBase>
        <PageHeader title="Execução da trilha" />
        <p className="opacity-60 mt-6">
          Preparando próximo passo…
        </p>
      </SectionBase>
    )
  }

  return (
    <SectionBase>
      <PageHeader
        title={item.title}
        description={`Etapa ${item.order}`}
      />

      <Card>
        <ProgressBar value={progress} />

        <div className="mt-6 space-y-4">
          {item.type === 'READING' && (
            <div className="text-sm leading-relaxed opacity-80">
              {item.content ??
                'Conteúdo de leitura não informado.'}
            </div>
          )}

          {item.type === 'ACTION' && (
            <div className="text-sm opacity-80">
              Execute a ação descrita e confirme
              quando finalizar.
            </div>
          )}

          {item.type === 'CHECKPOINT' && (
            <div className="text-sm opacity-80">
              Confirme que você compreendeu e
              concluiu este ponto.
            </div>
          )}

          <button
            disabled={busy}
            onClick={completeItem}
            className="mt-4 px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-40"
          >
            Concluir etapa
          </button>
        </div>
      </Card>
    </SectionBase>
  )
}
