import { useRef, useState, type FormEvent } from "react";
import { BookOpen, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { transientReadOptions } from "@/lib/read-query-retry";
import { useAuth } from "@/contexts/AuthContext";
import { can } from "@/lib/rbac";
import { useOrganizationLocale } from "@/contexts/OrganizationLocaleContext";
import {
  formatRecordedMoney,
  formatOrganizationDate,
} from "@/lib/organization-locale";
import { parseMoneyInputToCents } from "@/lib/money-input";
import { useFormDiscardGuard } from "@/hooks/useFormDiscardGuard";
import { FormModal } from "@/components/app-modal-system";
import {
  AppPageShell,
  AppSelect,
  AppEmptyState,
} from "@/components/app-system";
import {
  AppPageLoadingState,
  AppPageErrorState,
} from "@/components/internal-page-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogItem } from "@shared/service-catalog";
const panel =
  "min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4";
const muted = "text-sm text-[var(--text-muted)]";
const price = (item: { priceCents: number | null; currency: string }) =>
  item.priceCents === null
    ? "Sob consulta"
    : formatRecordedMoney(item.priceCents, item.currency, "Indisponível");
function History({ id }: { id: string }) {
  const [page, setPage] = useState(1),
    { timezone } = useOrganizationLocale();
  const query = trpc.serviceCatalog.history.useQuery(
    { id, page },
    transientReadOptions
  );
  if (query.isLoading)
    return <AppPageLoadingState description="Consultando histórico..." />;
  if (query.isError)
    return (
      <AppPageErrorState
        description="Não foi possível consultar o histórico."
        onAction={() => void query.refetch()}
      />
    );
  return (
    <div className="mt-3 grid min-w-0 gap-3">
      {query.data?.items.map(rev => (
        <div
          key={rev.id}
          className="min-w-0 border-t border-[var(--border-subtle)] pt-3 text-sm"
        >
          <p className="break-words font-medium">
            {rev.version === 0 ? "Cadastro inicial" : `Revisão ${rev.version}`}{" "}
            · {rev.actorName}
          </p>
          <p className={muted}>
            {formatOrganizationDate(rev.createdAt, timezone)}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words">{rev.reason}</p>
          <p className="mt-2 break-words">
            {rev.snapshot.code} · {rev.snapshot.name}
          </p>
          <p>
            {price(rev.snapshot)} ·{" "}
            {rev.snapshot.durationMinutes
              ? `${rev.snapshot.durationMinutes} min`
              : "Duração não informada"}{" "}
            · {rev.snapshot.active ? "Ativo" : "Arquivado"}
          </p>
          {rev.snapshot.description && (
            <p className="mt-2 whitespace-pre-wrap break-words">
              {rev.snapshot.description}
            </p>
          )}
        </div>
      ))}
      <Pager
        page={page}
        pages={query.data?.pages ?? 1}
        busy={query.isFetching}
        setPage={setPage}
      />
    </div>
  );
}
function Pager({
  page,
  pages,
  busy,
  setPage,
}: {
  page: number;
  pages: number;
  busy: boolean;
  setPage: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        disabled={page <= 1 || busy}
        onClick={() => setPage(page - 1)}
      >
        Anterior
      </Button>
      <span className="text-sm">
        {page}/{pages}
      </span>
      <Button
        variant="outline"
        disabled={page >= pages || busy}
        onClick={() => setPage(page + 1)}
      >
        Próxima
      </Button>
    </div>
  );
}
const empty = {
  code: "",
  name: "",
  description: "",
  price: "",
  duration: "",
  active: true,
  reason: "",
};
export default function ServiceCatalogPage() {
  const { role } = useAuth(),
    { currency } = useOrganizationLocale(),
    utils = trpc.useUtils();
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [state, setState] = useState("active"),
    [page, setPage] = useState(1),
    [historyId, setHistoryId] = useState("");
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<CatalogItem | null>(null),
    [form, setForm] = useState(empty),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const baseline = useRef(empty),
    draftCurrency = useRef(""),
    keys = useRef(new Map<string, string>()),
    lock = useRef(false);
  const list = trpc.serviceCatalog.list.useQuery(
      { page, q: search, state: state as "active" | "archived" | "all" },
      transientReadOptions
    ),
    create = trpc.serviceCatalog.create.useMutation(),
    edit = trpc.serviceCatalog.edit.useMutation();
  const manage = role ? can(role, "catalog:manage") : false;
  const close = () => {
    setOpen(false);
    setForm(empty);
    setError("");
  };
  const guard = useFormDiscardGuard({
    open,
    dirty: JSON.stringify(form) !== JSON.stringify(baseline.current),
    blocked: busy,
    onDiscard: close,
    guardNavigation: true,
  });
  function begin(item: CatalogItem | null) {
    setEditing(item);
    const next = item
      ? {
          code: item.code,
          name: item.name,
          description: item.description,
          price:
            item.priceCents === null
              ? ""
              : (item.priceCents / 100).toFixed(2).replace(".", ","),
          duration:
            item.durationMinutes === null ? "" : String(item.durationMinutes),
          active: item.active,
          reason: "",
        }
      : { ...empty };
    baseline.current = next;
    setForm(next);
    draftCurrency.current = item?.currency ?? currency ?? "";
    setError("");
    setOpen(true);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    setError("");
    try {
      if (!draftCurrency.current)
        throw new Error("Aguarde a confirmação da moeda da empresa.");
      const raw = form.price.trim();
      const amount =
        raw === ""
          ? null
          : /^0([,.]0{1,2})?$/.test(raw)
            ? 0
            : parseMoneyInputToCents(raw);
      if (raw !== "" && (amount === null || amount > 2147483647))
        throw new Error(
          "Informe um preço válido, como 150,00, ou deixe vazio para sob consulta."
        );
      const duration =
        form.duration.trim() === ""
          ? null
          : /^\d+$/.test(form.duration)
            ? Number(form.duration)
            : NaN;
      if (
        duration !== null &&
        (!Number.isInteger(duration) || duration < 1 || duration > 10080)
      )
        throw new Error("Informe uma duração inteira de 1 a 10080 minutos.");
      const values = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        priceCents: amount,
        durationMinutes: duration,
        expectedCurrency: draftCurrency.current,
      };
      lock.current = true;
      setBusy(true);
      if (editing) {
        await edit.mutateAsync({
          ...values,
          id: editing.id,
          active: form.active,
          expectedVersion: editing.version,
          reason: form.reason.trim(),
        });
      } else {
        const key = JSON.stringify(values);
        let entryKey = keys.current.get(key);
        if (!entryKey) {
          entryKey = crypto.randomUUID();
          keys.current.set(key, entryKey);
        }
        await create.mutateAsync({ ...values, entryKey });
        keys.current.delete(key);
      }
      close();
      setPage(1);
      setNotice(
        editing ? "Alteração salva no histórico." : "Serviço cadastrado."
      );
      void utils.serviceCatalog.invalidate();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar. Seus dados foram preservados."
      );
      void utils.serviceCatalog.list.invalidate();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const field = (key: keyof typeof empty, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));
  return (
    <AppPageShell className="operational-mobile-page mobile-module-page min-w-0 gap-4">
      <header className="flex min-w-0 flex-col items-start justify-between gap-3 sm:flex-row">
        <div className="min-w-0">
          <BookOpen className="mb-2 h-6 w-6 text-[var(--accent-primary)]" />
          <h1 className="text-2xl font-semibold">Catálogo de serviços</h1>
          <p className={`${muted} mt-2`}>
            Padronize serviços, preços de referência e duração.
          </p>
        </div>
        {manage && (
          <Button
            className="min-h-11"
            disabled={!currency}
            onClick={() => begin(null)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo serviço
          </Button>
        )}
      </header>
      <p className={muted}>
        Preços são referências. Este cadastro não altera O.S., estoque ou
        cobranças.
      </p>
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <form
        aria-label="Buscar serviços"
        className={`${panel} grid gap-3 sm:grid-cols-[1fr_auto_auto]`}
        onSubmit={e => {
          e.preventDefault();
          setSearch(q.trim());
          setPage(1);
        }}
      >
        <Input
          aria-label="Buscar por nome ou código"
          placeholder="Buscar nome ou código"
          value={q}
          maxLength={120}
          onChange={e => setQ(e.target.value)}
        />
        <AppSelect
          ariaLabel="Situação dos serviços"
          value={state}
          onValueChange={v => {
            setState(v);
            setPage(1);
          }}
          options={[
            { value: "active", label: "Ativos" },
            { value: "archived", label: "Arquivados" },
            { value: "all", label: "Todos" },
          ]}
        />
        <Button variant="outline" type="submit">
          Buscar
        </Button>
      </form>
      {list.isLoading ? (
        <AppPageLoadingState description="Consultando catálogo..." />
      ) : list.isError ? (
        <AppPageErrorState
          description="Não foi possível consultar o catálogo. Seus dados não foram alterados."
          onAction={() => void list.refetch()}
        />
      ) : (
        <>
          <p className={muted}>
            {list.data?.total ?? 0} serviço(s) no resultado
          </p>
          {!list.data?.items.length ? (
            <AppEmptyState
              title="Nenhum serviço encontrado"
              description="Cadastre um serviço ou ajuste os filtros para consultar arquivados."
            />
          ) : (
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {list.data.items.map(item => (
                <article key={item.id} aria-label={item.name} className={panel}>
                  <p className="break-words text-xs text-[var(--text-muted)]">
                    {item.code} · {item.active ? "Ativo" : "Arquivado"}
                  </p>
                  <h2 className="mt-2 break-words text-lg font-semibold">
                    {item.name}
                  </h2>
                  <p className="mt-3 text-xl font-semibold">{price(item)}</p>
                  <p className={`${muted} mt-1`}>
                    {item.durationMinutes
                      ? `${item.durationMinutes} min de referência`
                      : "Duração não informada"}
                  </p>
                  {item.description && (
                    <details className="mt-3 text-sm">
                      <summary className="min-h-11 cursor-pointer py-3">
                        Descrição do serviço
                      </summary>
                      <p className="whitespace-pre-wrap break-words">
                        {item.description}
                      </p>
                    </details>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {manage && (
                      <Button
                        variant="outline"
                        className="min-h-11"
                        onClick={() => begin(item)}
                      >
                        Editar serviço
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="min-h-11"
                      aria-expanded={historyId === item.id}
                      onClick={() =>
                        setHistoryId(prev => (prev === item.id ? "" : item.id))
                      }
                    >
                      {historyId === item.id
                        ? "Fechar histórico"
                        : "Ver histórico"}
                    </Button>
                  </div>
                  {historyId === item.id && (
                    <History key={item.id} id={item.id} />
                  )}
                </article>
              ))}
            </div>
          )}
          <Pager
            page={page}
            pages={list.data?.pages ?? 1}
            busy={list.isFetching}
            setPage={setPage}
          />
        </>
      )}
      {guard.confirmation}
      <FormModal
        open={open}
        onOpenChange={next => {
          if (!next) guard.requestClose();
        }}
        closeBlocked={busy}
        title={editing ? "Editar serviço" : "Novo serviço"}
        description={
          editing
            ? "Alterações preservam o histórico. A moeda deste serviço permanece a mesma."
            : "Preço vazio significa sob consulta. Zero é um preço de referência igual a zero."
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
            <Button type="submit" form="catalog-form" disabled={busy}>
              {busy ? "Salvando..." : "Salvar serviço"}
            </Button>
          </>
        }
      >
        <form
          id="catalog-form"
          onSubmit={submit}
          className="grid min-w-0 gap-3"
        >
          <fieldset disabled={busy} className="grid min-w-0 gap-3">
            <label htmlFor="catalog-code">Código</label>
            <Input
              id="catalog-code"
              value={form.code}
              onChange={e => field("code", e.target.value)}
              maxLength={40}
              pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}"
              required
            />
            <label htmlFor="catalog-name">Nome do serviço</label>
            <Input
              id="catalog-name"
              value={form.name}
              onChange={e => field("name", e.target.value)}
              minLength={2}
              maxLength={140}
              required
            />
            <label htmlFor="catalog-description">Descrição</label>
            <textarea
              id="catalog-description"
              value={form.description}
              onChange={e => field("description", e.target.value)}
              maxLength={2000}
              className="min-h-24 min-w-0 rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] p-3 text-base text-[var(--field-text)]"
            />
            <label htmlFor="catalog-price">
              Preço de referência ({draftCurrency.current})
            </label>
            <Input
              id="catalog-price"
              inputMode="decimal"
              placeholder="Sob consulta"
              value={form.price}
              onChange={e => field("price", e.target.value)}
            />
            <label htmlFor="catalog-duration">
              Duração de referência (minutos)
            </label>
            <Input
              id="catalog-duration"
              inputMode="numeric"
              placeholder="Não informada"
              value={form.duration}
              onChange={e => field("duration", e.target.value)}
            />
            {editing && (
              <>
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={e => field("active", e.target.checked)}
                  />
                  Serviço ativo
                </label>
                <p className={muted}>
                  Desmarque para arquivar. O histórico permanece disponível; o
                  código continua reservado.
                </p>
                <label htmlFor="catalog-reason">Motivo da alteração</label>
                <textarea
                  id="catalog-reason"
                  value={form.reason}
                  onChange={e => field("reason", e.target.value)}
                  required
                  minLength={10}
                  maxLength={1000}
                  className="min-h-24 min-w-0 rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] p-3 text-base text-[var(--field-text)]"
                />
              </>
            )}
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
    </AppPageShell>
  );
}
