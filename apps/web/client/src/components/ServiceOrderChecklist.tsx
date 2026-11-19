import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { transientReadOptions } from "@/lib/read-query-retry";
import { useFormDiscardGuard } from "@/hooks/useFormDiscardGuard";
import { FormModal } from "@/components/app-modal-system";
import {
  AppPageErrorState,
  AppPageLoadingState,
} from "@/components/internal-page-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOrganizationLocale } from "@/contexts/OrganizationLocaleContext";
import { formatOrganizationDate } from "@/lib/organization-locale";
import type { ChecklistItem } from "@shared/service-order-checklist";

export function ServiceOrderChecklist({
  serviceOrderId,
  status,
  canWrite,
}: {
  serviceOrderId: string;
  status: string;
  canWrite: boolean;
}) {
  const list = trpc.serviceOrders.checklist.useQuery(
    { serviceOrderId },
    transientReadOptions
  );
  const create = trpc.serviceOrders.createChecklistItem.useMutation(),
    change = trpc.serviceOrders.changeChecklistItem.useMutation(),
    utils = trpc.useUtils();
  const { timezone } = useOrganizationLocale();
  const [modal, setModal] = useState<
    { type: "create" } | { type: "undo"; item: ChecklistItem } | null
  >(null);
  const [value, setValue] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [modalError, setModalError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false),
    keys = useRef(new Map<string, string>());
  const close = () => {
    setModal(null);
    setValue("");
    setModalError("");
  };
  const guard = useFormDiscardGuard({
    open: Boolean(modal),
    dirty: Boolean(value),
    blocked: busy,
    onDiscard: close,
    guardNavigation: true,
  });
  const canAdd = canWrite && !["DONE", "CANCELED"].includes(status),
    canMark = canWrite && status === "IN_PROGRESS";
  const refresh = () =>
    Promise.allSettled([
      list.refetch(),
      utils.timeline.listByServiceOrder.invalidate(),
      utils.timeline.listByCustomer.invalidate(),
      utils.timeline.listByOrg.invalidate(),
    ]);
  async function mark(
    item: ChecklistItem,
    completed: boolean,
    reason?: string
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setModalError("");
    setNotice("");
    try {
      await change.mutateAsync({
        serviceOrderId,
        id: item.id,
        completed,
        expectedVersion: item.version,
        reason,
      });
      close();
      setNotice(
        completed
          ? "Tarefa concluída."
          : "Marcação desfeita com motivo registrado."
      );
      void refresh();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Não foi possível salvar a marcação.";
      if (modal) setModalError(message);
      else setError(message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!modal || lock.current) return;
    if (modal.type === "undo") {
      if (value.trim().length < 5) {
        setModalError("Informe o motivo com pelo menos 5 caracteres.");
        return;
      }
      await mark(modal.item, false, value.trim());
      return;
    }
    const title = value.trim();
    if (title.length < 3) {
      setModalError("Descreva a tarefa com pelo menos 3 caracteres.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setModalError("");
    setNotice("");
    let entryKey = keys.current.get(title);
    if (!entryKey) {
      entryKey = crypto.randomUUID();
      keys.current.set(title, entryKey);
    }
    try {
      await create.mutateAsync({ serviceOrderId, entryKey, title });
      keys.current.delete(title);
      close();
      setNotice("Tarefa adicionada.");
      void refresh();
    } catch (e) {
      setModalError(
        e instanceof Error
          ? e.message
          : "Não foi possível adicionar. Sua tarefa continua no formulário."
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const done = list.data?.filter(item => item.completed).length ?? 0;
  return (
    <section
      aria-label="Checklist da execução"
      className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4"
    >
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div>
          <h3 className="font-semibold">Checklist da execução</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Tarefas conferidas pela equipe. Este checklist não representa o
            aceite do cliente.
          </p>
        </div>
        {canAdd && (
          <Button
            variant="outline"
            className="min-h-11 shrink-0"
            disabled={
              busy ||
              list.isError ||
              list.isLoading ||
              (list.data?.length ?? 0) >= 30
            }
            onClick={() => {
              setModal({ type: "create" });
              setValue("");
              setModalError("");
            }}
          >
            Adicionar tarefa
          </Button>
        )}
      </div>
      {notice && (
        <p role="status" className="mt-3 text-sm">
          {notice}
        </p>
      )}
      {error && (
        <div role="alert" className="mt-3 text-sm text-[var(--danger)]">
          <p>{error}</p>
          <Button
            variant="outline"
            disabled={busy}
            className="mt-2 min-h-11"
            onClick={() => {
              setError("");
              void list.refetch();
            }}
          >
            Atualizar checklist
          </Button>
        </div>
      )}
      {list.isLoading ? (
        <AppPageLoadingState description="Consultando checklist..." />
      ) : list.isError ? (
        <AppPageErrorState
          description="Não foi possível consultar o checklist. Os demais dados da O.S. continuam disponíveis."
          onAction={() => void list.refetch()}
        />
      ) : (
        <>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            {done} de {list.data?.length ?? 0} tarefas concluídas
          </p>
          {list.data?.length ? (
            <ul className="mt-3 grid gap-3">
              {list.data.map(item => (
                <li
                  key={item.id}
                  className="min-w-0 rounded-xl border border-[var(--border-subtle)] p-3"
                >
                  <label className="flex min-h-11 items-center gap-3">
                    <input
                      type="checkbox"
                      aria-label={item.title}
                      className="size-5 shrink-0"
                      checked={item.completed}
                      disabled={!canMark || busy}
                      onChange={() => {
                        if (item.completed) {
                          setModal({ type: "undo", item });
                          setValue("");
                          setModalError("");
                        } else void mark(item, true);
                      }}
                    />
                    <span className="min-w-0 break-words text-sm">
                      {item.title}
                    </span>
                  </label>
                  {item.completed && (
                    <p className="mt-1 break-words text-xs text-[var(--text-muted)]">
                      Concluída por {item.completedByName} ·{" "}
                      {formatOrganizationDate(item.completedAt, timezone)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm">Nenhuma tarefa cadastrada.</p>
          )}
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Até 30 tarefas por O.S. Marque durante a execução. O.S. concluída ou
            cancelada mantém o checklist somente para consulta. As marcações não
            alteram o status do serviço.
          </p>
        </>
      )}
      {guard.confirmation}
      <FormModal
        open={Boolean(modal)}
        onOpenChange={next => {
          if (!next) guard.requestClose();
        }}
        closeBlocked={busy}
        title={
          modal?.type === "undo"
            ? "Desmarcar tarefa"
            : "Adicionar tarefa ao checklist"
        }
        description={
          modal?.type === "undo"
            ? modal.item.title
            : "Registre o que precisa ser conferido durante o serviço."
        }
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={guard.requestClose}
            >
              Cancelar
            </Button>
            <Button type="submit" form="checklist-form" disabled={busy}>
              {busy
                ? "Salvando..."
                : modal?.type === "undo"
                  ? "Confirmar motivo"
                  : "Salvar tarefa"}
            </Button>
          </>
        }
      >
        <form id="checklist-form" onSubmit={submit} className="grid gap-4">
          <label htmlFor="checklist-value" className="text-sm font-medium">
            {modal?.type === "undo"
              ? "Motivo para desmarcar"
              : "Descrição da tarefa"}
          </label>
          <Input
            id="checklist-value"
            value={value}
            onChange={e => setValue(e.target.value)}
            maxLength={modal?.type === "undo" ? 500 : 160}
            minLength={modal?.type === "undo" ? 5 : 3}
            required
            disabled={busy}
            autoComplete="off"
          />
          {modalError && (
            <p
              role="alert"
              className="break-words text-sm text-[var(--danger)]"
            >
              {modalError}
            </p>
          )}
        </form>
      </FormModal>
    </section>
  );
}
