import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { transientReadOptions } from "@/lib/read-query-retry";
import { useFormDiscardGuard } from "@/hooks/useFormDiscardGuard";
import { FormModal } from "@/components/app-modal-system";
import {
  AppPageLoadingState,
  AppPageErrorState,
} from "@/components/internal-page-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatOrganizationDate } from "@/lib/organization-locale";
import { useOrganizationLocale } from "@/contexts/OrganizationLocaleContext";
export function ServiceOrderAcceptance({
  serviceOrderId,
  title: orderTitle,
  status,
  canWrite,
}: {
  serviceOrderId: string;
  title: string;
  status: string;
  canWrite: boolean;
}) {
  const list = trpc.serviceAcceptance.list.useQuery(
      { serviceOrderId },
      transientReadOptions
    ),
    create = trpc.serviceAcceptance.create.useMutation(),
    revoke = trpc.serviceAcceptance.revoke.useMutation(),
    utils = trpc.useUtils();
  const { timezone } = useOrganizationLocale();
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState(orderTitle),
    [summary, setSummary] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [link, setLink] = useState(""),
    [revokeId, setRevokeId] = useState<string | null>(null);
  const lock = useRef(false),
    keys = useRef(new Map<string, string>());
  const close = () => {
    setOpen(false);
    setTitle(orderTitle);
    setSummary("");
    setError("");
  };
  const guard = useFormDiscardGuard({
    open,
    dirty: title !== orderTitle || Boolean(summary),
    blocked: busy,
    onDiscard: close,
    guardNavigation: true,
  });
  const refresh = () =>
    Promise.allSettled([
      list.refetch(),
      utils.timeline.listByServiceOrder.invalidate(),
      utils.timeline.listByCustomer.invalidate(),
      utils.timeline.listByOrg.invalidate(),
    ]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    const publicTitle = title.trim(),
      publicSummary = summary.trim();
    if (publicTitle.length < 3 || publicSummary.length < 10) {
      setError(
        "Revise o título e escreva um resumo com pelo menos 10 caracteres."
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    const fingerprint = JSON.stringify([publicTitle, publicSummary]);
    let entryKey = keys.current.get(fingerprint);
    if (!entryKey) {
      entryKey = crypto.randomUUID();
      keys.current.set(fingerprint, entryKey);
    }
    try {
      const result = await create.mutateAsync({
        serviceOrderId,
        entryKey,
        publicTitle,
        publicSummary,
      });
      setLink(`${window.location.origin}/service-acceptance#${result.token}`);
      keys.current.delete(fingerprint);
      close();
      setNotice("Link gerado. Copie e compartilhe pelo canal combinado.");
      void refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível gerar. Seu resumo continua no formulário."
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function confirmRevoke() {
    if (!revokeId || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await revoke.mutateAsync({ serviceOrderId, id: revokeId });
      setRevokeId(null);
      setLink("");
      setNotice("Link revogado. O histórico foi preservado.");
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível revogar.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Aceite do cliente"
      className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4"
    >
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div>
          <h3 className="font-semibold">Aceite do cliente</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Compartilhe um resumo revisado e acompanhe a resposta.
          </p>
        </div>
        {canWrite && status === "DONE" && (
          <Button
            variant="outline"
            className="min-h-11 shrink-0"
            disabled={
              busy ||
              list.isError ||
              list.isLoading ||
              (list.data?.length ?? 0) >= 20
            }
            onClick={() => {
              setOpen(true);
              setError("");
            }}
          >
            Gerar link de aceite
          </Button>
        )}
      </div>
      {status !== "DONE" && (
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Conclua a O.S. para solicitar o aceite.
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm">
          {notice}
        </p>
      )}
      {link && (
        <div className="mt-3 grid min-w-0 gap-2">
          <label htmlFor="acceptance-link" className="text-sm">
            Link para o cliente
          </label>
          <Input
            id="acceptance-link"
            readOnly
            value={link}
            onFocus={e => e.target.select()}
          />
          <Button
            variant="outline"
            className="min-h-11"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setNotice("Link copiado.");
              } catch {
                setNotice("Selecione o campo do link e copie manualmente.");
              }
            }}
          >
            Copiar link
          </Button>
        </div>
      )}
      {list.isLoading ? (
        <AppPageLoadingState description="Consultando solicitações..." />
      ) : list.isError ? (
        <AppPageErrorState
          description="Não foi possível consultar os aceites."
          onAction={() => void list.refetch()}
        />
      ) : !list.data?.length ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Nenhuma solicitação de aceite.
        </p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {list.data.map(item => (
            <li
              key={item.id}
              className="min-w-0 rounded-xl border border-[var(--border-subtle)] p-3"
            >
              <p className="break-words text-sm font-semibold">
                {item.publicTitle}
              </p>
              <p className="mt-2 text-sm">
                {item.decision === "ACCEPTED"
                  ? "Entrega confirmada"
                  : item.decision === "ISSUE"
                    ? "Problema apontado pelo cliente"
                    : item.revokedAt
                      ? "Link revogado"
                      : new Date(item.expiresAt).getTime() <= Date.now()
                        ? "Link expirado"
                        : "Aguardando resposta"}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Gerado em {formatOrganizationDate(item.createdAt, timezone)} ·
                Validade: {formatOrganizationDate(item.expiresAt, timezone)}
              </p>
              {item.respondedAt && (
                <p className="mt-2 break-words text-sm">
                  Nome informado: {item.respondentName} ·{" "}
                  {formatOrganizationDate(item.respondedAt, timezone)}
                </p>
              )}
              {item.responseNote && (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                  {item.responseNote}
                </p>
              )}
              <details className="mt-2 text-sm">
                <summary className="min-h-11 cursor-pointer py-2">
                  Resumo compartilhado
                </summary>
                <p className="whitespace-pre-wrap break-words">
                  {item.publicSummary}
                </p>
              </details>
              {item.revokedAt && item.respondedAt && (
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Acesso ao link revogado; resposta preservada.
                </p>
              )}
              {canWrite && !item.revokedAt && (
                <Button
                  variant="outline"
                  disabled={busy}
                  className="mt-3 min-h-11"
                  onClick={() => {
                    setError("");
                    setRevokeId(item.id);
                  }}
                >
                  Revogar acesso ao link
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        Links válidos por 72 horas. Gerar outro revoga o anterior ainda
        pendente. Fotos, contatos, valores e notas internas não são
        compartilhados automaticamente. Nome informado não é identidade
        verificada nem assinatura digital.
      </p>
      {guard.confirmation}
      <FormModal
        open={open}
        onOpenChange={next => {
          if (!next) guard.requestClose();
        }}
        closeBlocked={busy}
        title="Preparar aceite do cliente"
        description="Revise o que será compartilhado. Não inclua informações internas ou dados pessoais desnecessários."
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={guard.requestClose}
            >
              Cancelar
            </Button>
            <Button type="submit" form="acceptance-create" disabled={busy}>
              {busy ? "Gerando..." : "Gerar link"}
            </Button>
          </>
        }
      >
        <form id="acceptance-create" onSubmit={submit} className="grid gap-3">
          <label htmlFor="acceptance-title" className="text-sm">
            Título que o cliente verá
          </label>
          <Input
            id="acceptance-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            minLength={3}
            maxLength={160}
            required
            disabled={busy}
          />
          <label htmlFor="acceptance-summary" className="text-sm">
            Resumo compartilhado
          </label>
          <textarea
            id="acceptance-summary"
            value={summary}
            onChange={e => setSummary(e.target.value)}
            minLength={10}
            maxLength={1000}
            required
            disabled={busy}
            className="min-h-32 min-w-0 rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] p-3 text-base text-[var(--field-text)]"
          />
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
        open={Boolean(revokeId)}
        onOpenChange={next => {
          if (!next && !busy) setRevokeId(null);
        }}
        title="Revogar link de aceite?"
        description="O link deixará de abrir. Uma resposta já registrada continua no histórico."
        closeBlocked={busy}
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setRevokeId(null)}
            >
              Cancelar
            </Button>
            <Button disabled={busy} onClick={() => void confirmRevoke()}>
              {busy ? "Revogando..." : "Revogar link"}
            </Button>
          </>
        }
      >
        {error ? (
          <p role="alert" className="break-words text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : (
          <p className="text-sm">A revogação será registrada no histórico.</p>
        )}
      </FormModal>
    </section>
  );
}
