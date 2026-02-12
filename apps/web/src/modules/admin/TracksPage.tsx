import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import Card from '../../components/base/Card'
import PageHeader from '../../components/base/PageHeader'
import SectionBase from '../../components/layout/SectionBase'
import StatusBadge from '../../components/base/StatusBadge'

import {
  getTracks,
  createTrack,
  publishTrack,
  archiveTrack,
  type TrackListItem,
} from '../../services/tracks'

import { useExecutiveDashboard } from '../../hooks/useExecutiveDashboard'

export default function TracksPage() {
  const navigate = useNavigate()

  const [tracks, setTracks] = useState<TrackListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const { people } = useExecutiveDashboard()
  const hasPeople = people.length > 0

  async function load() {
    setLoading(true)
    const data = await getTracks()
    setTracks(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate() {
    if (!title.trim()) return
    setCreating(true)
    await createTrack({ title, description })
    setTitle('')
    setDescription('')
    setCreating(false)
    await load()
  }

  async function handlePublish(id: string) {
    await publishTrack(id)
    await load()
  }

  async function handleArchive(id: string) {
    await archiveTrack(id)
    await load()
  }

  if (loading) {
    return (
      <SectionBase>
        <PageHeader title="Trilhas" />
        <p className="mt-6 text-slate-400">
          Carregando trilhas…
        </p>
      </SectionBase>
    )
  }

  return (
    <SectionBase>
      <PageHeader
        title="Trilhas"
        description="Gestão institucional das trilhas de treinamento"
      />

      {/* ⚠️ AVISO INSTITUCIONAL */}
      {!hasPeople && (
        <Card className="mt-6">
          <div className="space-y-2 max-w-xl">
            <div className="font-medium">
              Governança incompleta
            </div>

            <p className="text-sm opacity-70">
              Trilhas só produzem efeito quando
              existem pessoas vinculadas.
            </p>

            <p className="text-sm opacity-70">
              Você pode criar e estruturar trilhas,
              mas nenhuma execução ocorrerá até
              que pessoas sejam cadastradas.
            </p>
          </div>
        </Card>
      )}

      {/* CRIAÇÃO */}
      <Card className="mt-6 space-y-3">
        <div className="font-medium">Nova trilha</div>

        <input
          className="w-full rounded bg-white/10 px-3 py-2 text-sm"
          placeholder="Título da trilha"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <textarea
          className="w-full rounded bg-white/10 px-3 py-2 text-sm"
          placeholder="Descrição (opcional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        <button
          onClick={handleCreate}
          disabled={creating}
          className="self-start rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Criar trilha (DRAFT)
        </button>
      </Card>

      {/* LISTAGEM */}
      <div className="mt-8 space-y-4">
        {tracks.length === 0 ? (
          <Card>
            <p className="text-sm opacity-70">
              Nenhuma trilha criada até o momento.
            </p>
          </Card>
        ) : (
          tracks.map(t => (
            <Card
              key={t.id}
              variant="clickable"
              onClick={() =>
                navigate(`/admin/trilhas/${t.id}`)
              }
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-medium">
                    {t.title}
                  </div>
                  <div className="text-xs opacity-60">
                    v{t.version} · {t.peopleCount} pessoas
                  </div>
                </div>

                <StatusBadge
                  label={t.status}
                  tone={
                    t.status === 'ACTIVE'
                      ? 'success'
                      : t.status === 'DRAFT'
                      ? 'warning'
                      : 'neutral'
                  }
                />
              </div>

              <div className="w-full h-2 rounded bg-white/10 overflow-hidden">
                <div
                  className="h-2 rounded bg-emerald-400"
                  style={{
                    width: `${t.completionRate}%`,
                  }}
                />
              </div>

              <div className="mt-3 flex gap-2">
                {t.status === 'DRAFT' && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handlePublish(t.id)
                    }}
                    className="text-xs px-3 py-1 rounded bg-emerald-500/10 text-emerald-400"
                  >
                    Publicar
                  </button>
                )}

                {t.status === 'ACTIVE' && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleArchive(t.id)
                    }}
                    className="text-xs px-3 py-1 rounded bg-rose-500/10 text-rose-400"
                  >
                    Arquivar
                  </button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </SectionBase>
  )
}
