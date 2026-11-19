import { useRef, useState } from "react";
import { ReturnCoverageEditor } from './ReturnCoverageEditor';
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { transientReadOptions } from "@/lib/read-query-retry";
import { useFormDiscardGuard } from "@/hooks/useFormDiscardGuard";
import { FormModal } from "@/components/app-modal-system";
import { AppSelect } from "@/components/app-system";
import {
  AppPageLoadingState,
  AppPageErrorState,
} from "@/components/internal-page-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatOrganizationDate } from "@/lib/organization-locale";
import { useOrganizationLocale } from "@/contexts/OrganizationLocaleContext";
const statusLabel = {
  OPEN: "Aberta",
  ASSIGNED: "Atribuída",
  IN_PROGRESS: "Em execução",
  DONE: "Concluída",
  CANCELED: "Cancelada",
};
export function ServiceOrderReturns({
  serviceOrderId,
  title: originalTitle,
  status,
  canCreate,
}: {
  serviceOrderId: string;
  title: string;
  status: string;
  canCreate: boolean;
}) {
  const [, navigate] = useLocation(),
    { timezone } = useOrganizationLocale(),
    utils = trpc.useUtils();
  const [page, setPage] = useState(1),
    [open, setOpen] = useState(false),
    [title, setTitle] = useState(("Retorno: " + originalTitle).slice(0, 140)),
    [reason, setReason] = useState(""),
    [kind, setKind] = useState<"WARRANTY" | "REWORK">("WARRANTY"),
    [issue, setIssue] = useState("none"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [createdId, setCreatedId] = useState("");
  const list = trpc.serviceOrders.returns.useQuery(
      { serviceOrderId, page },
      transientReadOptions
    ),
    create = trpc.serviceOrders.createReturn.useMutation();
  const lock = useRef(false),
    keys = useRef(new Map<string, string>());
  const defaultTitle = ("Retorno: " + originalTitle).slice(0, 140);
  const close = () => {
    setOpen(false);
    setTitle(defaultTitle);
    setReason("");
    setKind("WARRANTY");
    setIssue("none");
    setError("");
  };
  const guard = useFormDiscardGuard({
    open,
    dirty:
      title !== defaultTitle ||
      Boolean(reason) ||
      kind !== "WARRANTY" ||
      issue !== "none",
    blocked: busy,
    onDiscard: close,
    guardNavigation: true,
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    if (title.trim().length < 3 || reason.trim().length < 10) {
      setError("Informe o título e um motivo com pelo menos 10 caracteres.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    const payload = {
      serviceOrderId,
      kind,
      title: title.trim(),
      reason: reason.trim(),
      sourceAcceptanceId: issue === "none" ? undefined : issue,
    };
    const fingerprint = JSON.stringify(payload);
    let entryKey = keys.current.get(fingerprint);
    if (!entryKey) {
      entryKey = crypto.randomUUID();
      keys.current.set(fingerprint, entryKey);
    }
    try {
      const result = await create.mutateAsync({ ...payload, entryKey });
      keys.current.delete(fingerprint);
      close();
      setCreatedId(result.child.id);
      setPage(1);
      void Promise.allSettled([
        utils.serviceOrders.returns.invalidate(),
        utils.serviceOrders.page.invalidate(),
        utils.serviceOrders.list.invalidate(),
        utils.timeline.listByOrg.invalidate(),
        utils.timeline.listByCustomer.invalidate(),
        utils.timeline.listByServiceOrder.invalidate(),
        utils.customers.workspace.invalidate(),
        utils.dashboard.kpis.invalidate(),
        utils.dashboard.alerts.invalidate(),
        utils.dashboard.executivePipeline.invalidate(),
      ]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível abrir o retorno. Seus dados continuam no formulário."
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Garantia e retrabalho"
      className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4"
    >
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div>
          <h3 className="font-semibold">Garantia e retrabalho</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Acompanhe retornos sem reabrir nem substituir a O.S. original.
          </p>
        </div>
        {canCreate && status === "DONE" && (
          <Button
            variant="outline"
            className="min-h-11 shrink-0"
            disabled={list.isLoading || list.isError || busy}
            onClick={() => {
              setError("");
              setOpen(true);
            }}
          >
            Abrir retorno
          </Button>
        )}
      </div>
      {createdId && (
        <div className="mt-3">
          <p role="status" className="text-sm">
            Retorno aberto. Nenhuma cobrança foi gerada.
          </p>
          <Button
            className="mt-2 min-h-11"
            onClick={() => navigate("/service-orders?id=" + createdId)}
          >
            Abrir nova O.S.
          </Button>
        </div>
      )}
      {list.isLoading ? (
        <AppPageLoadingState description="Consultando retornos..." />
      ) : list.isError ? (
        <AppPageErrorState
          description="Não foi possível consultar os retornos. Os demais dados da O.S. continuam disponíveis."
          onAction={() => void list.refetch()}
        />
      ) : (
        <>
          {list.data?.origin && (
            <div className="mt-3 rounded-xl border border-[var(--border-subtle)] p-3">
              <p className="break-words text-sm font-semibold">
                Esta O.S. é um retorno de: {list.data.origin.originalTitle}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                {list.data.origin.reason}
              </p>
              <ReturnCoverageEditor item={list.data.origin} />
              <Button
                variant="outline"
                className="mt-3 min-h-11"
                onClick={() =>
                  navigate(
                    "/service-orders?id=" + list.data!.origin!.original.id
                  )
                }
              >
                Ver O.S. original
              </Button>
            </div>
          )}
          {!list.data?.items.length ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Nenhum retorno aberto a partir desta O.S.
            </p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {list.data.items.map(item => (
                <li
                  key={item.id}
                  className="min-w-0 rounded-xl border border-[var(--border-subtle)] p-3"
                >
                  <p className="break-words text-sm font-semibold">
                    {item.child.title}
                  </p>
                  <p className="mt-2 text-sm">
                    {item.kind === "WARRANTY"
                      ? "Análise de garantia"
                      : "Retrabalho"}{" "}
                    · {statusLabel[item.child.status]}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                    {item.reason}
                  </p>
                  <ReturnCoverageEditor item={item} />
                  {item.sourceAcceptanceId && (
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      Vinculado a um problema relatado no aceite.
                    </p>
                  )}
                  <p className="mt-2 break-words text-xs text-[var(--text-muted)]">
                    Aberto por {item.createdByName} ·{" "}
                    {formatOrganizationDate(item.createdAt, timezone)}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3 min-h-11"
                    onClick={() =>
                      navigate("/service-orders?id=" + item.child.id)
                    }
                  >
                    Ver O.S. de retorno
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {(list.data?.pages ?? 1) > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || list.isFetching}
                onClick={() => setPage(p => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm">
                Página {page} de {list.data!.pages}
              </span>
              <Button
                variant="outline"
                disabled={page >= list.data!.pages || list.isFetching}
                onClick={() => setPage(p => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        Retornos seguem o limite de O.S. do plano. A classificação não aprova
        cobertura ou gratuidade. Valores, pagamentos, responsável e agendamento
        não são copiados. A abertura do retorno não envia mensagens automaticamente.
      </p>
      {guard.confirmation}
      <FormModal
        open={open}
        onOpenChange={next => {
          if (!next) guard.requestClose();
        }}
        title="Abrir retorno do serviço"
        description="Será criada uma nova O.S. aberta para o mesmo cliente. Avalie cobertura e condições com ele antes da execução."
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
            <Button type="submit" form="return-create" disabled={busy}>
              {busy ? "Abrindo..." : "Criar O.S. de retorno"}
            </Button>
          </>
        }
      >
        <form
          id="return-create"
          onSubmit={submit}
          className="grid min-w-0 gap-3"
        >
          <fieldset disabled={busy} className="grid min-w-0 gap-3">
            <label htmlFor="return-title" className="text-sm">
              Título da nova O.S.
            </label>
            <Input
              id="return-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              minLength={3}
              maxLength={140}
              required
            />
            <AppSelect
              ariaLabel="Classificação do retorno"
              value={kind}
              onValueChange={v => setKind(v as "WARRANTY" | "REWORK")}
              options={[
                { value: "WARRANTY", label: "Análise de garantia" },
                { value: "REWORK", label: "Retrabalho" },
              ]}
            />
            <AppSelect
              ariaLabel="Relato de problema vinculado"
              value={issue}
              onValueChange={v => {
                setIssue(v);
                if (!reason)
                  setReason(
                    list.data?.issues.find(i => i.id === v)?.responseNote || ""
                  );
              }}
              options={[
                { value: "none", label: "Sem relato de aceite vinculado" },
                ...(list.data?.issues ?? []).map(i => ({
                  value: i.id,
                  label:
                    i.publicTitle +
                    " · " +
                    formatOrganizationDate(i.respondedAt, timezone),
                })),
              ]}
            />
            <label htmlFor="return-reason" className="text-sm">
              Motivo do retorno
            </label>
            <textarea
              id="return-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              minLength={10}
              maxLength={2000}
              required
              className="min-h-32 min-w-0 rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] p-3 text-base text-[var(--field-text)]"
            />
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
    </section>
  );
}
