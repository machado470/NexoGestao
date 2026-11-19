import { useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { useFormDiscardGuard } from "@/hooks/useFormDiscardGuard";
import { FormModal } from "@/components/app-modal-system";
import { Button } from "@/components/ui/button";
import { useOrganizationLocale } from "@/contexts/OrganizationLocaleContext";
import { formatOrganizationDate } from "@/lib/organization-locale";
import type { ReturnRecord } from "@shared/service-order-returns";

export function ReturnCaseEditor({ item }: { item: ReturnRecord }) {
  const { role } = useAuth(),
    { timezone } = useOrganizationLocale(),
    utils = trpc.useUtils();
  const mutation = trpc.serviceOrders.setReturnCaseState.useMutation();
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  // Capture the intended transition/version on opening. Refetch must not silently rebase a draft.
  const attempt = useRef({
      state: "CLOSED" as "ACTIVE" | "CLOSED",
      version: 0,
    }),
    lock = useRef(false);
  const close = () => {
    setOpen(false);
    setReason("");
    setError("");
  };
  const guard = useFormDiscardGuard({
    open,
    dirty: Boolean(reason),
    blocked: busy,
    onDiscard: close,
    guardNavigation: true,
  });
  const closed = item.caseState === "CLOSED",
    canManage = role === "ADMIN" || role === "MANAGER";
  const ready =
    item.child.status === "CANCELED" ||
    (item.child.status === "DONE" &&
      item.child.billingTreatment !== "RETURN_PENDING" &&
      item.child.billingTreatment !== undefined);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    if (reason.trim().length < 10) {
      setError("Descreva o motivo com pelo menos 10 caracteres.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await mutation.mutateAsync({
        serviceOrderId: item.original.id,
        id: item.id,
        state: attempt.current.state,
        expectedVersion: attempt.current.version,
        reason: reason.trim(),
      });
      close();
      setNotice(
        result.caseState === "CLOSED"
          ? "Acompanhamento encerrado. Cobranças e pagamentos continuam nos seus fluxos."
          : "Acompanhamento reaberto. A situação da O.S. foi preservada."
      );
      void Promise.allSettled([
        utils.serviceOrders.returns.invalidate(),
        utils.timeline.listByOrg.invalidate(),
        utils.timeline.listByCustomer.invalidate(),
        utils.timeline.listByServiceOrder.invalidate(),
      ]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível registrar. Seu motivo foi preservado."
      );
      void utils.serviceOrders.returns.invalidate();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  // Older API during an independent deploy: do not offer an unsupported mutation.
  if (!item.caseState) return null;
  return (
    <div
      aria-label="Acompanhamento do retorno"
      className="mt-3 min-w-0 rounded-xl border border-[var(--border-subtle)] p-3"
    >
      <p className="text-sm font-semibold">
        {closed ? "Acompanhamento encerrado" : "Acompanhamento em aberto"}
      </p>
      {item.caseReviewedAt && (
        <p className="mt-2 break-words text-xs text-[var(--text-muted)]">
          {closed ? "Encerrado" : "Reaberto"} por {item.caseReviewedByName} ·{" "}
          {formatOrganizationDate(item.caseReviewedAt, timezone)}
        </p>
      )}
      {item.caseReason && (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">
          {item.caseReason}
        </p>
      )}
      {!closed && !ready && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Para encerrar, conclua a O.S. e defina a cobertura, ou cancele a O.S.
          com o motivo correspondente.
        </p>
      )}
      {notice && (
        <p role="status" className="mt-2 break-words text-sm">
          {notice}
        </p>
      )}
      {canManage && (
        <Button
          variant="outline"
          className="mt-3 min-h-11 w-full whitespace-normal"
          disabled={!closed && !ready}
          onClick={() => {
            attempt.current = {
              state: closed ? "ACTIVE" : "CLOSED",
              version: item.caseVersion ?? 0,
            };
            setReason("");
            setError("");
            setOpen(true);
          }}
        >
          {closed ? "Reabrir acompanhamento" : "Encerrar acompanhamento"}
        </Button>
      )}
      {guard.confirmation}
      <FormModal
        open={open}
        onOpenChange={next => {
          if (!next) guard.requestClose();
        }}
        closeBlocked={busy}
        title={
          attempt.current.state === "CLOSED"
            ? "Encerrar acompanhamento"
            : "Reabrir acompanhamento"
        }
        description={item.child.title}
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
              form={"case-state-" + item.id}
              disabled={busy}
            >
              {busy ? "Registrando..." : "Confirmar registro"}
            </Button>
          </>
        }
      >
        <form
          id={"case-state-" + item.id}
          onSubmit={submit}
          className="grid min-w-0 gap-3"
        >
          <p className="text-sm text-[var(--text-muted)]">
            Este registro organiza o acompanhamento interno. Não altera a
            situação da O.S., a cobertura, o aceite do cliente, cobranças ou
            pagamentos. Não envia mensagens.
          </p>
          <label htmlFor={"case-reason-" + item.id} className="text-sm">
            {attempt.current.state === "CLOSED"
              ? "Desfecho e motivo do encerramento"
              : "Motivo da reabertura"}
          </label>
          <textarea
            id={"case-reason-" + item.id}
            value={reason}
            onChange={e => setReason(e.target.value)}
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
    </div>
  );
}
