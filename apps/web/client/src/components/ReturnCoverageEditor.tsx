import { useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { useFormDiscardGuard } from "@/hooks/useFormDiscardGuard";
import { FormModal } from "@/components/app-modal-system";
import { AppSelect } from "@/components/app-system";
import { Button } from "@/components/ui/button";
import { useOrganizationLocale } from "@/contexts/OrganizationLocaleContext";
import { formatOrganizationDate } from "@/lib/organization-locale";
import type { ReturnRecord } from "@shared/service-order-returns";
type Treatment = "RETURN_PENDING" | "RETURN_COVERED" | "RETURN_BILLABLE";
const labels = {
  RETURN_PENDING: "Aguardando avaliação comercial",
  RETURN_COVERED: "Cobertura aprovada · sem cobrança nesta O.S.",
  RETURN_BILLABLE: "Serviço cobrável",
};
export function ReturnCoverageEditor({ item }: { item: ReturnRecord }) {
  const { role } = useAuth(),
    { timezone } = useOrganizationLocale(),
    utils = trpc.useUtils(),
    mutation = trpc.serviceOrders.setReturnCoverage.useMutation();
  const [open, setOpen] = useState(false),
    [treatment, setTreatment] = useState<Treatment>("RETURN_PENDING"),
    [reason, setReason] = useState(""),
    [version, setVersion] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    initialTreatment = useRef<Treatment>("RETURN_PENDING");
  const close = () => {
    setOpen(false);
    setReason("");
    setError("");
  };
  const guard = useFormDiscardGuard({
    open,
    dirty: Boolean(reason) || treatment !== initialTreatment.current,
    blocked: busy,
    onDiscard: close,
    guardNavigation: true,
  });
  const current = item.child.billingTreatment;
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
      await mutation.mutateAsync({
        serviceOrderId: item.original.id,
        id: item.id,
        treatment,
        reason: reason.trim(),
        expectedVersion: version,
      });
      close();
      setNotice(
        "Decisão registrada. Esta decisão não criou cobrança nem estorno."
      );
      void Promise.allSettled([
        utils.serviceOrders.returns.invalidate(),
        utils.serviceOrders.page.invalidate(),
        utils.serviceOrders.list.invalidate(),
        utils.serviceOrders.getById.invalidate(),
        utils.customers.operationalSummaryPage.invalidate(),
        utils.customers.workspace.invalidate(),
        utils.dashboard.kpis.invalidate(),
        utils.dashboard.alerts.invalidate(),
        utils.dashboard.operationalSignals.invalidate(),
        utils.dashboard.nextBestAction.invalidate(),
        utils.governance.operationalState.invalidate(),
        utils.governance.autoScore.invalidate(),
        utils.people.operationalSummary.invalidate(),
        utils.timeline.listByOrg.invalidate(),
        utils.timeline.listByCustomer.invalidate(),
        utils.timeline.listByServiceOrder.invalidate(),
      ]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível registrar a decisão."
      );
      void utils.serviceOrders.returns.invalidate();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div
      id={"return-coverage-" + item.child.id}
      tabIndex={-1}
      aria-label="Condição comercial do retorno"
      className="mt-3 min-w-0 rounded-xl border border-[var(--border-subtle)] p-3"
    >
      <p className="break-words text-sm font-semibold">
        {labels[current as Treatment] ?? "Condição comercial anterior"}
      </p>
      {item.coverageReviewedAt ? (
        <>
          <p className="mt-2 break-words text-xs text-[var(--text-muted)]">
            Decisão de {item.coverageReviewedByName} ·{" "}
            {formatOrganizationDate(item.coverageReviewedAt, timezone)}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">
            {item.coverageReason}
          </p>
        </>
      ) : current === "RETURN_BILLABLE" ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Condição preservada por já existir cobrança anterior.
        </p>
      ) : null}
      {notice && (
        <p role="status" className="mt-2 text-sm">
          {notice}
        </p>
      )}
      {role !== "ADMIN" &&
        role !== "MANAGER" &&
        current === "RETURN_PENDING" && (
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Solicite a avaliação de um gestor para definir a condição comercial.
          </p>
        )}
      {(role === "ADMIN" || role === "MANAGER") &&
        item.child.status !== "CANCELED" && item.caseState !== "CLOSED" && (
          <Button
            variant="outline"
            className="mt-3 min-h-11"
            onClick={() => {
              initialTreatment.current =
                current === "RETURN_COVERED" || current === "RETURN_BILLABLE"
                  ? current
                  : "RETURN_PENDING";
              setTreatment(initialTreatment.current);
              setVersion(item.coverageVersion ?? 0);
              setReason("");
              setError("");
              setOpen(true);
            }}
          >
            Registrar decisão comercial
          </Button>
        )}
      {guard.confirmation}
      <FormModal
        open={open}
        onOpenChange={next => {
          if (!next) guard.requestClose();
        }}
        closeBlocked={busy}
        title="Decidir cobertura do retorno"
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
            <Button type="submit" form={"coverage-" + item.id} disabled={busy}>
              {busy ? "Registrando..." : "Confirmar decisão"}
            </Button>
          </>
        }
      >
        <form
          id={"coverage-" + item.id}
          onSubmit={submit}
          className="grid min-w-0 gap-4"
        >
          <fieldset disabled={busy} className="grid min-w-0 gap-4">
            <AppSelect
              ariaLabel="Condição comercial"
              value={treatment}
              onValueChange={v => setTreatment(v as Treatment)}
              options={[
                { value: "RETURN_PENDING", label: "Aguardando avaliação" },
                {
                  value: "RETURN_COVERED",
                  label: "Coberto, sem cobrança nesta O.S.",
                },
                { value: "RETURN_BILLABLE", label: "Serviço cobrável" },
              ]}
            />
            <p className="text-sm text-[var(--text-muted)]">
              {treatment === "RETURN_BILLABLE"
                ? "Autoriza cobrança manual ou automática pelos fluxos existentes da empresa. Esta decisão não cria cobrança por si só."
                : "Impede novas cobranças vinculadas a este retorno. Só é permitido se ainda não houver cobrança vinculada."}{" "}
              Nenhum pagamento será cancelado ou estornado. Links de aceite
              pendentes da O.S. de retorno precisam ser gerados novamente após
              esta alteração.
            </p>
            <label htmlFor={"coverage-reason-" + item.id} className="text-sm">
              Motivo da decisão
            </label>
            <textarea
              id={"coverage-reason-" + item.id}
              value={reason}
              onChange={e => setReason(e.target.value)}
              minLength={10}
              maxLength={1000}
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
    </div>
  );
}
