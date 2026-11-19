import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/app-modal-system";
import {
  AppPageLoadingState,
  AppPageErrorState,
} from "@/components/internal-page-system";
import { transientReadOptions } from "@/lib/read-query-retry";
import { prepareEvidencePhoto } from "@/lib/evidence-photo";
import { useFormDiscardGuard } from "@/hooks/useFormDiscardGuard";
import { useOrganizationLocale } from "@/contexts/OrganizationLocaleContext";
import { formatOrganizationDate } from "@/lib/organization-locale";

export function ServiceOrderEvidence({
  serviceOrderId,
  status,
  canWrite,
}: {
  serviceOrderId: string;
  status: string;
  canWrite: boolean;
}) {
  const { timezone } = useOrganizationLocale();
  const list = trpc.serviceOrders.evidence.useQuery(
    { serviceOrderId },
    transientReadOptions
  );
  const mutation = trpc.serviceOrders.addEvidence.useMutation(),
    utils = trpc.useUtils();
  const [open, setOpen] = useState(false),
    [image, setImage] = useState(""),
    [description, setDescription] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const photo = trpc.serviceOrders.evidenceImage.useQuery(
    { serviceOrderId, id: viewId || serviceOrderId },
    { ...transientReadOptions, enabled: Boolean(viewId), gcTime: 0 }
  );
  const lock = useRef(false),
    keys = useRef(new Map<string, string>());
  const discard = () => {
    setOpen(false);
    setImage("");
    setDescription("");
    setConfirmed(false);
    setError("");
  };
  const guard = useFormDiscardGuard({
    open,
    dirty: Boolean(image || description || confirmed),
    blocked: busy || mutation.isPending,
    guardNavigation: true,
    onDiscard: discard,
  });
  const allowed = canWrite && ["IN_PROGRESS", "DONE"].includes(status);
  async function choose(file?: File) {
    if (!file || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      setImage(await prepareEvidencePhoto(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler a foto.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    if (!image || description.trim().length < 5 || !confirmed) {
      setError("Escolha uma foto, descreva a execução e confirme o registro.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    const fingerprint = JSON.stringify([image, description.trim()]);
    let entryKey = keys.current.get(fingerprint);
    if (!entryKey) {
      entryKey = crypto.randomUUID();
      keys.current.set(fingerprint, entryKey);
    }
    try {
      await mutation.mutateAsync({
        serviceOrderId,
        imageBase64: image,
        description: description.trim(),
        professionalConfirmed: true,
        entryKey,
      });
      keys.current.delete(fingerprint);
      discard();
      setNotice("Foto e confirmação registradas.");
      void Promise.allSettled([
        list.refetch(),
        utils.timeline.listByServiceOrder.invalidate(),
        utils.timeline.listByCustomer.invalidate(),
        utils.timeline.listByOrg.invalidate(),
      ]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar. Sua foto continua no formulário."
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4"
      aria-label="Fotos da execução"
    >
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div>
          <h3 className="font-semibold">Fotos da execução</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Registro do profissional. O aceite do cliente é uma confirmação
            separada.
          </p>
        </div>
        {allowed && (
          <Button
            variant="outline"
            className="min-h-11 shrink-0"
            onClick={() => {
              setNotice("");
              setOpen(true);
            }}
            disabled={
              list.isLoading || list.isError || (list.data?.length ?? 0) >= 12
            }
          >
            <Camera className="mr-2 size-4" />
            Adicionar foto
          </Button>
        )}
      </div>
      {notice && (
        <p role="status" className="mt-3 text-sm">
          {notice}
        </p>
      )}
      {list.isLoading ? (
        <AppPageLoadingState description="Consultando fotos..." />
      ) : list.isError ? (
        <AppPageErrorState
          description="Não foi possível consultar as fotos. Os demais dados da O.S. continuam disponíveis."
          onAction={() => void list.refetch()}
        />
      ) : (
        <>
          {!list.data?.length ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Nenhuma foto registrada.
              {canWrite && !allowed
                ? " Inicie a O.S. para registrar a execução."
                : ""}
            </p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {list.data.map(item => (
                <li
                  key={item.id}
                  className="min-w-0 rounded-xl border border-[var(--border-subtle)] p-3"
                >
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {item.description}
                  </p>
                  <p className="mt-2 break-words text-xs text-[var(--text-muted)]">
                    Confirmado por {item.uploadedByName} ·{" "}
                    {formatOrganizationDate(item.createdAt, timezone)}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3 min-h-11"
                    onClick={() => setViewId(item.id)}
                  >
                    Ver foto
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Até 12 fotos otimizadas por O.S. Guarde o original se precisar dele.
            Os registros são preservados e não alteram o status da O.S.
          </p>
        </>
      )}
      {guard.confirmation}
      <FormModal
        open={open}
        onOpenChange={next => {
          if (!next) guard.requestClose();
        }}
        title="Registrar foto da execução"
        description="A foto será otimizada antes de salvar. Não envie dados pessoais desnecessários."
        closeBlocked={busy}
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={guard.requestClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="order-evidence-form"
              disabled={busy || !image || !confirmed}
            >
              {busy ? "Preparando registro..." : "Salvar registro"}
            </Button>
          </>
        }
      >
        <form
          id="order-evidence-form"
          onSubmit={save}
          className="grid min-w-0 gap-4"
        >
          <fieldset disabled={busy} className="grid min-w-0 gap-4">
            <label className="grid min-w-0 gap-2 text-sm">
              Foto
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="min-h-11 w-full min-w-0 text-sm"
                onChange={e => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void choose(file);
                }}
              />
            </label>
            {image && (
              <img
                src={`data:image/jpeg;base64,${image}`}
                alt="Prévia da foto selecionada"
                className="max-h-64 w-full rounded-xl object-contain"
              />
            )}
            <div className="grid gap-2 text-sm">
              <label htmlFor="evidence-description">O que foi executado?</label>
              <textarea
                id="evidence-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                minLength={5}
                maxLength={1000}
                required
                rows={3}
                className="min-w-0 rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] p-3 text-base text-[var(--field-text)]"
              />
            </div>
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                required
              />
              <span>
                Confirmo que esta foto e o relato correspondem à execução desta
                O.S.
              </span>
            </label>
          </fieldset>
          {error && (
            <p
              role="alert"
              className="break-words text-sm text-[var(--danger)]"
            >
              {error}
            </p>
          )}
        </form>
      </FormModal>
      <FormModal
        open={Boolean(viewId)}
        onOpenChange={value => {
          if (!value) setViewId(null);
        }}
        title="Foto registrada"
        description={list.data?.find(item => item.id === viewId)?.description}
        footer={
          <Button variant="outline" onClick={() => setViewId(null)}>
            Fechar
          </Button>
        }
      >
        {photo.isLoading ? (
          <AppPageLoadingState description="Carregando foto..." />
        ) : photo.isError ? (
          <AppPageErrorState
            description="Não foi possível abrir a foto."
            onAction={() => void photo.refetch()}
          />
        ) : (
          photo.data && (
            <img
              alt="Foto registrada na ordem de serviço"
              src={`data:image/jpeg;base64,${photo.data.imageBase64}`}
              className="max-h-[60vh] w-full object-contain"
            />
          )
        )}
      </FormModal>
    </section>
  );
}
