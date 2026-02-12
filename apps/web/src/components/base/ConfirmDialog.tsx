export default function ConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl bg-slate-900 border border-white/10 p-6 space-y-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description && (
            <p className="text-sm opacity-70 mt-1">
              {description}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-sm px-4 py-2 rounded bg-white/5 hover:bg-white/10"
          >
            Cancelar
          </button>

          <button
            onClick={onConfirm}
            disabled={loading}
            className="text-sm px-4 py-2 rounded bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {loading ? 'Processando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
