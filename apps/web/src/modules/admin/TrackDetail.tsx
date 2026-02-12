import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import PageHeader from '../../components/base/PageHeader'
import Card from '../../components/base/Card'
import StatusBadge from '../../components/base/StatusBadge'

import {
  getTrack,
  publishTrack,
  archiveTrack,
  type TrackDetail,
} from '../../services/tracks'

import {
  listTrackItems,
  removeTrackItem,
  type TrackItem,
} from '../../services/trackItems'

export default function TrackDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [track, setTrack] = useState<TrackDetail | null>(null)
  const [items, setItems] = useState<TrackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!id) return

    const [trackData, itemsData] =
      await Promise.all([
        getTrack(id),
        listTrackItems(id),
      ])

    setTrack(trackData)
    setItems(itemsData)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [id])

  function confirmAction(message: string) {
    return window.confirm(message)
  }

  async function handlePublish() {
    if (!id || !track) return
    if (!confirmAction('Publicar esta trilha?')) return

    setBusy(true)
    await publishTrack(id)
    await load()
    setBusy(false)
  }

  async function handleArchive() {
    if (!id || !track) return
    if (!confirmAction('Arquivar esta trilha?')) return

    setBusy(true)
    await archiveTrack(id)
    await load()
    setBusy(false)
  }

  async function handleRemoveItem(itemId: string) {
    if (!confirmAction('Remover este item?')) return

    setBusy(true)
    await removeTrackItem(itemId)
    await load()
    setBusy(false)
  }

  if (loading || !track) {
    return (
      <div className="text-sm opacity-60">
        Carregando trilha…
      </div>
    )
  }

  const isDraft = track.status === 'DRAFT'
  const isArchived = track.status === 'ARCHIVED'

  return (
    <div className="space-y-8">
      <PageHeader
        title={track.title}
        description={track.description ?? undefined}
      />

      <Card>
        <div className="flex items-center justify-between">
          <StatusBadge label={track.status} />

          <div className="flex gap-2">
            {isDraft && (
              <button
                disabled={busy}
                onClick={handlePublish}
                className="px-3 py-1 rounded bg-emerald-600 text-white"
              >
                Publicar
              </button>
            )}

            {!isArchived && (
              <button
                disabled={busy}
                onClick={handleArchive}
                className="px-3 py-1 rounded bg-rose-600 text-white"
              >
                Arquivar
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="font-medium mb-3">
          Itens da trilha
        </div>

        {items.length === 0 && (
          <p className="text-sm opacity-60">
            Nenhum item criado.
          </p>
        )}

        <ul className="space-y-2 text-sm">
          {items.map(i => (
            <li
              key={i.id}
              className="flex items-center justify-between"
            >
              <span>
                {i.order}. {i.title}
              </span>

              {isDraft && (
                <button
                  onClick={() =>
                    handleRemoveItem(i.id)
                  }
                  className="text-xs px-2 py-1 rounded bg-rose-600 text-white"
                >
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
