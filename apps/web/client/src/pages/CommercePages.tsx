import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { Link } from "wouter";
import {
  Package,
  ReceiptText,
  HeartPulse,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { transientReadOptions } from "@/lib/read-query-retry";
import {
  formatRecordedMoney,
  formatOrganizationDate,
} from "@/lib/organization-locale";
import { useOrganizationLocale } from "@/contexts/OrganizationLocaleContext";
import { parseMoneyInputToCents } from "@/lib/money-input";
import { parseLocalDateTimeInput } from "@/lib/local-date-time";
import { useFormDiscardGuard } from "@/hooks/useFormDiscardGuard";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { Product } from "@shared/commerce";

const money = (value: number | null, currency: string) =>
  formatRecordedMoney(value ?? undefined, currency, "Indisponível");
const panel =
  "min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 md:p-5";
function requiredCurrency(value: string | undefined) {
  if (!value) throw new Error("Aguarde a confirmação da moeda da empresa.");
  return value;
}
const muted = "text-sm text-[var(--text-muted)]";
function text(value: string, min: number, label: string) {
  const result = value.trim();
  if (result.length < min)
    throw new Error(`${label}: informe pelo menos ${min} caracteres.`);
  return result;
}
function integer(value: string, min = 0) {
  const n = /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(n) || n < min || n > 1000000000)
    throw new Error(`Informe uma quantidade inteira a partir de ${min}.`);
  return n;
}
function amount(value: string, allowZero = false) {
  if (allowZero && /^0([,.]0{1,2})?$/.test(value.trim())) return 0;
  const n = parseMoneyInputToCents(value);
  if (n === null)
    throw new Error("Informe um valor monetário válido, como 150,00.");
  return n;
}

function Workspace({
  title,
  description,
  icon,
  action,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppPageShell className="operational-mobile-page mobile-module-page commerce-workspace min-w-0 gap-4">
      <header className="flex min-w-0 flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            {icon}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {title}
          </h1>
          <p className={`${muted} mt-2 max-w-2xl`}>{description}</p>
        </div>
        {action}
      </header>
      <nav
        aria-label="Estoque, fiscal e saúde financeira"
        className="flex flex-wrap gap-2"
      >
        {[
          ["/inventory", "Estoque"],
          ["/fiscal", "Notas fiscais"],
          ["/financial-health", "Saúde financeira"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border-subtle)] px-3 text-sm hover:bg-[var(--accent-soft)]"
          >
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </AppPageShell>
  );
}
function ReadState({
  query,
  children,
}: {
  query: {
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    refetch: () => unknown;
  };
  children: ReactNode;
}) {
  if (query.isLoading || (query.isFetching && query.isError))
    return <AppPageLoadingState title="Consultando os registros" />;
  if (query.isError)
    return (
      <AppPageErrorState
        title="Não foi possível consultar esta seção"
        description="Seus registros não foram substituídos por dados de demonstração. Tente novamente."
        onAction={() => void query.refetch()}
      />
    );
  return <>{children}</>;
}
function Field({
  label,
  ...props
}: React.ComponentProps<typeof Input> & { label: string }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium">
      <span>{label}</span>
      <Input {...props} />
    </label>
  );
}
function useCommerceForm<V extends Record<string, string>, P>(
  initial: V,
  prepare: (values: V) => P,
  persist: (payload: P, key: string) => Promise<unknown>,
  onSaved: () => void
) {
  const [values, setValues] = useState(initial),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const baseline = useRef(initial),
    lock = useRef(false),
    keys = useRef(new Map<string, string>());
  const discard = () => {
    setOpen(false);
    setValues(initial);
    setError("");
  };
  const guard = useFormDiscardGuard({
    open,
    dirty: JSON.stringify(values) !== JSON.stringify(baseline.current),
    blocked: busy || lock.current,
    guardNavigation: true,
    onDiscard: discard,
  });
  const start = (context = initial) => {
    baseline.current = context;
    setValues(context);
    setError("");
    setOpen(true);
  };
  const edit = (key: keyof V, value: string) => {
    if (!lock.current) setValues(previous => ({ ...previous, [key]: value }));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (lock.current) return;
    let payload: P;
    try {
      payload = prepare(values);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revise os dados.");
      return;
    }
    const fingerprint = JSON.stringify(payload);
    const key = keys.current.get(fingerprint) ?? crypto.randomUUID();
    keys.current.set(fingerprint, key);
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await persist(payload, key);
      keys.current.delete(fingerprint);
      discard();
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível confirmar. Confira os registros antes de tentar novamente."
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return { values, open, busy, error, start, edit, submit, guard };
}
function Editor({
  form,
  title,
  submitLabel,
  children,
}: {
  form: {
    open: boolean;
    busy: boolean;
    error: string;
    submit: (event: FormEvent) => Promise<void>;
    guard: ReturnType<typeof useFormDiscardGuard>;
  };
  title: string;
  submitLabel: string;
  children: ReactNode;
}) {
  const id = title.replace(/\s/g, "-");
  return (
    <>
      {form.guard.confirmation}
      <FormModal
        open={form.open}
        onOpenChange={next => {
          if (!next) form.guard.requestClose();
        }}
        title={title}
        closeBlocked={form.busy}
        footer={
          <>
            <Button
              variant="outline"
              disabled={form.busy}
              onClick={form.guard.requestClose}
            >
              Cancelar
            </Button>
            <Button type="submit" form={id} disabled={form.busy}>
              {form.busy ? "Salvando…" : submitLabel}
            </Button>
          </>
        }
      >
        <form id={id} onSubmit={form.submit} className="min-w-0 space-y-4">
          {form.error ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {form.error}
            </p>
          ) : null}
          <fieldset disabled={form.busy} className="grid min-w-0 gap-4">
            {children}
          </fieldset>
        </form>
      </FormModal>
    </>
  );
}

export function InventoryPage() {
  const { currency, timezone } = useOrganizationLocale();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const products = trpc.commerce.products.useQuery(
    { page, q: query },
    transientReadOptions
  );
  const movements = trpc.commerce.movements.useQuery(
    undefined,
    transientReadOptions
  );
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const create = trpc.commerce.createProduct.useMutation(),
    move = trpc.commerce.move.useMutation();
  const saved = () => {
    setNotice("Registro confirmado.");
    void products.refetch();
    void movements.refetch();
  };
  const productForm = useCommerceForm(
    {
      sku: "",
      name: "",
      barcode: "",
      variant: "",
      min: "0",
      cost: "0,00",
      sale: "0,00",
    },
    v => ({
      expectedCurrency: requiredCurrency(currency),
      sku: v.sku.trim().toUpperCase(),
      name: text(v.name, 2, "Nome do produto"),
      barcode: v.barcode.trim() || undefined,
      variant: v.variant.trim() || undefined,
      minQuantity: integer(v.min),
      costCents: amount(v.cost, true),
      saleCents: amount(v.sale, true),
    }),
    payload => create.mutateAsync(payload),
    saved
  );
  const moveForm = useCommerceForm(
    { product: "", direction: "IN", quantity: "1", reason: "", order: "" },
    v => {
      if (!v.product) throw new Error("Selecione o produto.");
      return {
        productId: v.product,
        direction: v.direction as "IN" | "OUT",
        quantity: integer(v.quantity, 1),
        reason: text(v.reason, 3, "Motivo"),
        serviceOrderId: v.order.trim() || undefined,
      };
    },
    (payload, entryKey) => move.mutateAsync({ ...payload, entryKey }),
    saved
  );
  const beginMove = (product: Product, direction: string) => {
    setSelectedProduct(product);
    moveForm.start({
      product: product.id,
      direction,
      quantity: "1",
      reason: "",
      order: "",
    });
  };
  const movementOptions = [
    ...(selectedProduct ? [selectedProduct] : []),
    ...(products.data?.items ?? []).filter(p => p.id !== selectedProduct?.id),
  ];
  return (
    <Workspace
      title="Estoque"
      description="Peças e produtos por SKU, variação e código de barras. Entradas e saídas ficam registradas por profissional."
      icon={<Package />}
      action={
        <Button onClick={() => productForm.start()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo produto
        </Button>
      }
    >
      {notice ? (
        <p role="status" className={muted}>
          {notice}
        </p>
      ) : null}
      <div className={panel}>
        <Field
          label="Buscar por nome, SKU ou código de barras"
          value={search}
          maxLength={120}
          onChange={e => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <ReadState query={products}>
        {products.data?.items.length === 0 ? (
          <AppEmptyState
            title="Nenhum produto encontrado"
            description="Cadastre cada variação com um SKU próprio. Registre a primeira entrada para formar o saldo."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {products.data?.items.map(p => (
              <article key={p.id} className={`${panel} space-y-3`}>
                <div>
                  <p className="break-words text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {p.sku}
                  </p>
                  <h2 className="break-words text-lg font-semibold">
                    {p.name}
                  </h2>
                  <p className={muted}>
                    {p.variant || "Sem variação"}
                    {p.barcode ? ` · ${p.barcode}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <p>
                    <strong className="text-3xl tabular-nums">
                      {p.onHand}
                    </strong>{" "}
                    <span className={muted}>unidades</span>
                  </p>
                  <span className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs">
                    {p.onHand <= p.minQuantity ? "Repor estoque" : "Disponível"}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className={muted}>Custo unitário</dt>
                    <dd>{money(p.costCents, p.currency)}</dd>
                  </div>
                  <div>
                    <dt className={muted}>Preço de venda</dt>
                    <dd>{money(p.saleCents, p.currency)}</dd>
                  </div>
                </dl>
                <p className={muted}>Estoque mínimo: {p.minQuantity}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => beginMove(p, "IN")}>
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Entrada
                  </Button>
                  <Button variant="outline" onClick={() => beginMove(p, "OUT")}>
                    <ArrowUpFromLine className="mr-2 h-4 w-4" />
                    Saída
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
        {products.data ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>
              {products.data.total} produtos · Página {page} de{" "}
              {products.data.pages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || products.isFetching}
                onClick={() => setPage(p => p - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={page >= products.data!.pages || products.isFetching}
                onClick={() => setPage(p => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        ) : null}
      </ReadState>
      <section className={`${panel} space-y-3`}>
        <h2 className="text-lg font-semibold">Últimas movimentações</h2>
        <ReadState query={movements}>
          {movements.data?.length === 0 ? (
            <p className={muted}>Nenhuma entrada ou saída registrada.</p>
          ) : (
            <ol className="divide-y divide-[var(--border-subtle)]">
              {movements.data?.map(m => (
                <li key={m.id} className="space-y-1 py-3">
                  <strong>
                    {m.direction === "IN" ? "+" : "−"}
                    {m.quantity} · {m.product?.name ?? "Produto"}
                  </strong>
                  <p className={muted}>{m.reason}</p>
                  <p className={muted}>
                    {formatOrganizationDate(
                      m.createdAt,
                      timezone,
                      "Data indisponível",
                      { dateStyle: "short", timeStyle: "short" }
                    )}
                    {m.serviceOrderId ? ` · O.S. ${m.serviceOrderId}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </ReadState>
        <p className={muted}>
          Exibindo as 50 movimentações mais recentes. Saldo em unidades
          inteiras; reservas, compras e sincronização com lojas serão etapas
          seguintes.
        </p>
      </section>
      <Editor
        form={productForm}
        title="Novo produto"
        submitLabel="Cadastrar produto"
      >
        <Field
          label="SKU"
          required
          pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,63}"
          maxLength={64}
          value={productForm.values.sku}
          onChange={e => productForm.edit("sku", e.target.value)}
        />
        <Field
          label="Nome do produto"
          required
          minLength={2}
          maxLength={180}
          value={productForm.values.name}
          onChange={e => productForm.edit("name", e.target.value)}
        />
        <Field
          label="Código de barras (opcional)"
          maxLength={64}
          value={productForm.values.barcode}
          onChange={e => productForm.edit("barcode", e.target.value)}
        />
        <Field
          label="Variação, como modelo, cor ou voltagem"
          maxLength={100}
          value={productForm.values.variant}
          onChange={e => productForm.edit("variant", e.target.value)}
        />
        <Field
          label="Estoque mínimo (unidades inteiras)"
          required
          inputMode="numeric"
          value={productForm.values.min}
          onChange={e => productForm.edit("min", e.target.value)}
        />
        <Field
          label={`Custo unitário (${currency ?? "moeda da empresa"})`}
          required
          inputMode="decimal"
          value={productForm.values.cost}
          onChange={e => productForm.edit("cost", e.target.value)}
        />
        <Field
          label={`Preço de venda (${currency ?? "moeda da empresa"})`}
          required
          inputMode="decimal"
          value={productForm.values.sale}
          onChange={e => productForm.edit("sale", e.target.value)}
        />
        <p className={muted}>
          O produto inicia sem saldo. Use Entrada para registrar a quantidade
          recebida.
        </p>
      </Editor>
      <Editor
        form={moveForm}
        title="Movimentar estoque"
        submitLabel="Confirmar movimentação"
      >
        <label className="grid gap-2 text-sm">
          Produto
          <AppSelect
            ariaLabel="Produto da movimentação"
            value={moveForm.values.product}
            onValueChange={v => moveForm.edit("product", v)}
            options={movementOptions.map(p => ({
              value: p.id,
              label: `${p.sku} · ${p.name}`,
            }))}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Tipo
          <AppSelect
            ariaLabel="Tipo de movimentação"
            value={moveForm.values.direction}
            onValueChange={v => moveForm.edit("direction", v)}
            options={[
              { value: "IN", label: "Entrada" },
              { value: "OUT", label: "Saída" },
            ]}
          />
        </label>
        <Field
          label="Quantidade (unidades inteiras)"
          required
          inputMode="numeric"
          value={moveForm.values.quantity}
          onChange={e => moveForm.edit("quantity", e.target.value)}
        />
        <Field
          label="Motivo"
          required
          minLength={3}
          maxLength={500}
          value={moveForm.values.reason}
          onChange={e => moveForm.edit("reason", e.target.value)}
        />
        <Field
          label="Identificador da O.S. (opcional)"
          maxLength={100}
          value={moveForm.values.order}
          onChange={e => moveForm.edit("order", e.target.value)}
        />
        <p className={muted}>
          Saídas não podem deixar o estoque negativo. A movimentação não gera
          cobrança nem despesa automaticamente.
        </p>
      </Editor>
    </Workspace>
  );
}

export function FiscalPage() {
  const { currency, timezone } = useOrganizationLocale();
  const drafts = trpc.commerce.fiscalDrafts.useQuery(
    undefined,
    transientReadOptions
  );
  const customers = trpc.customers.list.useQuery(
    undefined,
    transientReadOptions
  );
  const create = trpc.commerce.createFiscalDraft.useMutation();
  const [saved, setSaved] = useState(false);
  const form = useCommerceForm(
    { customer: "", order: "", description: "", amount: "" },
    v => {
      if (!v.customer) throw new Error("Selecione o cliente.");
      return {
        expectedCurrency: requiredCurrency(currency),
        customerId: v.customer,
        serviceOrderId: v.order.trim() || undefined,
        description: text(v.description, 5, "Descrição do serviço"),
        amountCents: amount(v.amount),
      };
    },
    (payload, entryKey) => create.mutateAsync({ ...payload, entryKey }),
    () => {
      setSaved(true);
      void drafts.refetch();
    }
  );
  const people = normalizeArrayPayload<{ id: string; name: string }>(
    customers.data
  );
  return (
    <Workspace
      title="Notas fiscais"
      description="Organize os dados do serviço e prepare a emissão para o cliente correto."
      icon={<ReceiptText />}
      action={
        <Button onClick={() => form.start()}>
          <Plus className="mr-2 h-4 w-4" />
          Preparar nota
        </Button>
      }
    >
      <section className={`${panel} space-y-2`}>
        <h2 className="font-semibold">Conectar emissão fiscal</h2>
        <p className={muted}>
          A emissão autorizada de NFS-e depende de um provedor fiscal e da
          configuração tributária da empresa. Esta seção salva preparações; não
          emite documentos fiscais nem gera número, XML ou autorização.
        </p>
        <p className={muted}>
          As faturas comerciais do Financeiro não substituem uma nota fiscal.
        </p>
      </section>
      {saved ? (
        <p role="status" className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Preparação salva. Nenhuma nota foi emitida.
        </p>
      ) : null}
      <ReadState query={drafts}>
        {drafts.data?.items.length === 0 ? (
          <AppEmptyState
            title="Nenhuma preparação de nota"
            description="Separe os dados do cliente, a descrição e o valor do serviço. Revise o enquadramento fiscal com sua contabilidade antes de emitir."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {drafts.data?.items.map(d => (
              <article key={d.id} className={`${panel} space-y-3`}>
                <span className="inline-block rounded-lg bg-[var(--accent-soft)] px-2 py-1 text-xs">
                  Preparação · Não emitida
                </span>
                <h2 className="font-semibold">
                  {d.customer?.name ?? "Cliente"}
                </h2>
                <p className={muted}>
                  {d.customer?.cpfCnpj
                    ? `CPF/CNPJ: ${d.customer.cpfCnpj}`
                    : "CPF/CNPJ do cliente ainda não informado"}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {d.description}
                </p>
                <strong className="block text-xl">
                  {money(d.amountCents, d.currency)}
                </strong>
                <p className={muted}>
                  {formatOrganizationDate(
                    d.createdAt,
                    timezone,
                    "Data indisponível",
                    { dateStyle: "short" }
                  )}
                </p>
                <Link
                  href={`/customers?customerId=${encodeURIComponent(d.customerId)}`}
                  className="inline-flex min-h-11 items-center text-sm underline"
                >
                  Conferir cliente
                </Link>
                {d.serviceOrderId ? (
                  <Link
                    href={`/service-orders?id=${encodeURIComponent(d.serviceOrderId)}`}
                    className="ml-3 inline-flex min-h-11 items-center text-sm underline"
                  >
                    Ver O.S.
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        )}
        <p className={`${muted} mt-3`}>Exibindo até 50 preparações recentes.</p>
      </ReadState>
      <Editor
        form={form}
        title="Preparar nota fiscal"
        submitLabel="Salvar preparação"
      >
        <ReadState query={customers}>
          <label className="grid gap-2 text-sm">
            Cliente
            <AppSelect
              ariaLabel="Cliente da nota"
              value={form.values.customer}
              onValueChange={v => form.edit("customer", v)}
              options={people.map(c => ({ value: c.id, label: c.name }))}
            />
          </label>
        </ReadState>
        <Field
          label="Identificador da O.S. (opcional)"
          maxLength={100}
          value={form.values.order}
          onChange={e => form.edit("order", e.target.value)}
        />
        <label className="grid gap-2 text-sm">
          Descrição do serviço
          <textarea
            className="min-h-28 w-full rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] p-3 text-[var(--field-text)]"
            required
            minLength={5}
            maxLength={3000}
            value={form.values.description}
            onChange={e => form.edit("description", e.target.value)}
          />
        </label>
        <Field
          label={`Valor do serviço (${currency ?? "moeda da empresa"})`}
          required
          inputMode="decimal"
          value={form.values.amount}
          onChange={e => form.edit("amount", e.target.value)}
        />
      </Editor>
    </Workspace>
  );
}

export function FinancialHealthPage() {
  const { currency, timezone } = useOrganizationLocale();
  const [month, setMonth] = useState(""),
    [notice, setNotice] = useState("");
  const report = trpc.commerce.health.useQuery(
    { month: month || undefined },
    transientReadOptions
  );
  const expense = trpc.commerce.recordExpense.useMutation();
  const classify = trpc.commerce.classifyExpenseCurrency.useMutation();
  const currencyForm = useCommerceForm(
    { id: "", currency: "" },
    v => {
      if (!/^[A-Z]{3}$/.test(v.currency.trim().toUpperCase()))
        throw new Error("Informe o código da moeda original, como BRL.");
      return { id: v.id, currency: v.currency.trim().toUpperCase() };
    },
    payload => classify.mutateAsync(payload),
    () => {
      setNotice("Moeda da despesa definida.");
      void report.refetch();
    }
  );
  const form = useCommerceForm(
    { title: "", amount: "", date: "" },
    v => {
      const date = parseLocalDateTimeInput(
        `${v.date}T12:00`,
        undefined,
        timezone
      );
      if (!date) throw new Error("Informe uma data válida no fuso da empresa.");
      return {
        expectedCurrency: requiredCurrency(currency),
        title: text(v.title, 2, "Descrição da despesa"),
        amountCents: amount(v.amount),
        occurredAt: date.toISOString(),
      };
    },
    (payload, entryKey) => expense.mutateAsync({ ...payload, entryKey }),
    () => {
      setNotice("Despesa registrada.");
      void report.refetch();
    }
  );
  return (
    <Workspace
      title="Saúde financeira"
      description="Recebimentos, despesas registradas e valores em aberto, separados por moeda."
      icon={<HeartPulse />}
      action={
        <Button onClick={() => form.start()}>
          <Plus className="mr-2 h-4 w-4" />
          Registrar despesa
        </Button>
      }
    >
      <section className={panel}>
        <Field
          label="Mês de análise"
          type="month"
          min="2000-01"
          max="9999-12"
          value={month || report.data?.month || ""}
          onChange={e => setMonth(e.target.value)}
        />
        <p className={`${muted} mt-2`}>
          O período usa o fuso da empresa. Valores em aberto mostram a carteira
          atual, independentemente do mês selecionado.
        </p>
      </section>
      {notice ? (
        <p role="status" className={muted}>
          {notice}
        </p>
      ) : null}
      <ReadState query={report}>
        {report.data?.unclassifiedExpenseCount ? (
          <p role="alert" className={panel}>
            {report.data.unclassifiedExpenseCount} despesas antigas não possuem
            moeda registrada. O resultado permanece indisponível para evitar
            misturar valores.
          </p>
        ) : null}
        <div className="grid gap-4 xl:grid-cols-2">
          {report.data?.currencies.map(r => (
            <section key={r.currency} className={`${panel} space-y-4`}>
              <h2 className="text-lg font-semibold">Resumo · {r.currency}</h2>
              <dl className="grid grid-cols-2 gap-4">
                {[
                  ["Recebido no mês", r.receivedCents],
                  ["Reembolsado no mês", r.refundedCents],
                  ["Despesas registradas", r.expensesCents],
                  ["Resultado dos registros", r.recordedResultCents],
                  ["A receber · carteira atual", r.openCents],
                  ["Em atraso · carteira atual", r.overdueCents],
                ].map(([label, value]) => (
                  <div key={String(label)} className="min-w-0">
                    <dt className={muted}>{label}</dt>
                    <dd className="mt-1 break-words text-lg font-semibold tabular-nums">
                      {money(value as number | null, r.currency)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <section className={`${panel} mt-4 space-y-3`}>
          <h2 className="font-semibold">Despesas consideradas no período</h2>
          {report.data?.recentExpenses.length === 0 ? (
            <p className={muted}>Nenhuma despesa registrada neste recorte.</p>
          ) : (
            <ol className="divide-y divide-[var(--border-subtle)]">
              {report.data?.recentExpenses.map(e => (
                <li key={e.id} className="space-y-2 py-3">
                  <strong>{e.title}</strong>
                  <p className={muted}>
                    {e.currency
                      ? money(e.amountCents, e.currency)
                      : "Valor com moeda ainda não definida"}{" "}
                    ·{" "}
                    {e.recurrence === "MONTHLY"
                      ? "Recorrente mensal"
                      : formatOrganizationDate(
                          e.occurredAt,
                          timezone,
                          "Data indisponível",
                          { dateStyle: "short" }
                        )}
                  </p>
                  {!e.currency ? (
                    <Button
                      variant="outline"
                      onClick={() =>
                        currencyForm.start({ id: e.id, currency: "" })
                      }
                    >
                      Definir moeda original
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          <p className={muted}>
            Até 50 despesas, priorizando as que precisam definir a moeda.
            Despesas recorrentes ativas são consideradas uma vez no mês.
          </p>
        </section>
        <p className={`${muted} mt-3`}>
          Resultado dos registros = recebimentos menos reembolsos e despesas do
          período. Não é saldo bancário, lucro contábil nem previsão de caixa;
          não inclui compromissos ainda não registrados. Não há conversão entre
          moedas.
        </p>
        <Link
          href="/finances"
          className="inline-flex min-h-11 items-center text-sm underline"
        >
          Conferir cobranças e pagamentos
        </Link>
      </ReadState>
      <Editor
        form={currencyForm}
        title="Definir moeda da despesa"
        submitLabel="Confirmar moeda"
      >
        <Field
          label="Moeda original (código de 3 letras)"
          required
          minLength={3}
          maxLength={3}
          placeholder="BRL"
          value={currencyForm.values.currency}
          onChange={e =>
            currencyForm.edit("currency", e.target.value.toUpperCase())
          }
        />
        <p className={muted}>
          Consulte o comprovante e informe a moeda original. O valor numérico é
          preservado, sem conversão.
        </p>
      </Editor>
      <Editor
        form={form}
        title="Registrar despesa"
        submitLabel="Salvar despesa"
      >
        <Field
          label="Descrição da despesa"
          required
          minLength={2}
          maxLength={180}
          value={form.values.title}
          onChange={e => form.edit("title", e.target.value)}
        />
        <Field
          label={`Valor (${currency ?? "moeda da empresa"})`}
          required
          inputMode="decimal"
          value={form.values.amount}
          onChange={e => form.edit("amount", e.target.value)}
        />
        <Field
          label="Data da despesa"
          required
          type="date"
          value={form.values.date}
          onChange={e => form.edit("date", e.target.value)}
        />
        <p className={muted}>
          Registre uma despesa operacional efetiva. Não cria pagamento bancário
          nem baixa uma cobrança.
        </p>
      </Editor>
    </Workspace>
  );
}
