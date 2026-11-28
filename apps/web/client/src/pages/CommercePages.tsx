import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { Link, useLocation } from "wouter";
import {
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
  AppPageHeader,
  AppFiltersBar,
  AppPageLoadingState,
  AppPageErrorState,
} from "@/components/internal-page-system";
import { rawMaterialUnit, type Product } from "@shared/commerce";

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
const materialUnitLabels = { KG: "kg", L: "L", M: "m" } as const;
function materialQuantity(value: string, min = 0) {
  const match = /^(\d+)(?:[,.](\d{1,3}))?$/.exec(value.trim());
  const quantity = match
    ? Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"))
    : NaN;
  if (!Number.isSafeInteger(quantity) || quantity < min || quantity > 1000000000)
    throw new Error("Informe uma quantidade válida, com até três casas decimais.");
  return quantity;
}

function stockQuantity(count: number, unit?: Product["rawMaterialUnit"]) {
  if (!unit) return String(count);
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3 }).format(count / 1000);
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
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [location] = useLocation();

  return (
    <AppPageShell className="operational-mobile-page mobile-module-page commerce-workspace min-w-0 gap-4">
      <AppPageHeader title={title} description={description} actions={action} />
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
            aria-current={location === href ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border-subtle)] px-3 text-sm hover:bg-[var(--accent-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] aria-[current=page]:border-[var(--accent-primary)] aria-[current=page]:bg-[var(--accent-soft)] aria-[current=page]:text-[var(--nx-brand-text,var(--accent-primary))]"
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
    move = trpc.commerce.move.useMutation(),
    createKit = trpc.commerce.createKit.useMutation(),
    withdrawKit = trpc.commerce.withdrawKit.useMutation();
  const saved = () => {
    setNotice("Registro confirmado.");
    void products.refetch();
    void movements.refetch();
  };
  const productDefaults = {
    kind: "SIMPLE",
    parentSku: "",
    rawMaterialUnit: "KG",
    sku: "",
    name: "",
    barcode: "",
    variant: "",
    min: "0",
    cost: "0,00",
    sale: "0,00",
    components: JSON.stringify([{ sku: "", quantity: "1" }]),
  };
  const productForm = useCommerceForm(
    productDefaults,
    v => {
      if (v.kind === "KIT") {
        const rows: { sku: string; quantity: string }[] = JSON.parse(v.components);
        return {
          expectedCurrency: requiredCurrency(currency),
          sku: v.sku.trim().toUpperCase(),
          name: text(v.name, 2, "Nome do kit"),
          saleCents: amount(v.sale, true),
          components: rows.map(row => ({
            sku: text(row.sku, 1, "SKU do componente").toUpperCase(),
            quantity: integer(row.quantity, 1),
          })),
        };
      }
      const kind = v.kind === "PARENT" || v.kind === "VARIANT" || v.kind === "RAW_MATERIAL" ? v.kind : "SIMPLE";
      return {
        kind: kind as Exclude<Product["kind"], "KIT">,
        expectedCurrency: requiredCurrency(currency),
        sku: v.sku.trim().toUpperCase(),
        name: text(v.name, 2, "Nome do produto"),
        parentSku: kind === "VARIANT" ? v.parentSku.trim().toUpperCase() : undefined,
        barcode: kind === "PARENT" ? undefined : v.barcode.trim() || undefined,
        variant: kind === "VARIANT" ? text(v.variant, 1, "Variação") : undefined,
        rawMaterialUnit: kind === "RAW_MATERIAL" ? rawMaterialUnit.parse(v.rawMaterialUnit) : undefined,
        minQuantity: kind === "PARENT" ? 0 : kind === "RAW_MATERIAL" ? materialQuantity(v.min) : integer(v.min),
        costCents: kind === "PARENT" ? 0 : amount(v.cost, true),
        saleCents: kind === "PARENT" || kind === "RAW_MATERIAL" ? 0 : amount(v.sale, true),
      };
    },
    payload => "components" in payload && payload.components ? createKit.mutateAsync(payload) : create.mutateAsync(payload),
    saved
  );
  const moveForm = useCommerceForm(
    { product: "", direction: "IN", quantity: "1", reason: "", order: "" },
    v => {
      if (!v.product) throw new Error("Selecione o produto.");
      const material = movementOptions.find(p => p.id === v.product)?.rawMaterialUnit;
      return {
        productId: v.product,
        direction: v.direction as "IN" | "OUT",
        quantity: material ? materialQuantity(v.quantity, 1) : integer(v.quantity, 1),
        quantityScale: material ? "THOUSANDTHS" as const : undefined,
        reason: text(v.reason, 3, "Motivo"),
        serviceOrderId: v.order.trim() || undefined,
      };
    },
    (payload, entryKey) => move.mutateAsync({ ...payload, entryKey }),
    saved
  );
  const kitWithdrawalForm = useCommerceForm(
    { kitId: "", quantity: "1", reason: "" },
    v => ({ kitId: v.kitId, quantity: integer(v.quantity, 1), reason: text(v.reason, 3, "Motivo") }),
    (payload, entryKey) => withdrawKit.mutateAsync({ ...payload, entryKey }),
    saved
  );
  const kitComponents: { sku: string; quantity: string }[] = JSON.parse(productForm.values.components);
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
    ...(products.data?.items ?? []).filter(p => p.kind !== "PARENT" && p.kind !== "KIT" && p.id !== selectedProduct?.id),
  ];
  const movementUnit = movementOptions.find(p => p.id === moveForm.values.product)?.rawMaterialUnit;
  const materialForm = productForm.values.kind === "RAW_MATERIAL";
  const formUnit = materialUnitLabels[rawMaterialUnit.parse(productForm.values.rawMaterialUnit)];
  return (
    <Workspace
      title="Estoque"
      description="Peças e produtos por SKU, variação e código de barras. Entradas e saídas ficam registradas por profissional."
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
      <AppFiltersBar className="[&>label]:w-full">
        <Field
          type="search"
          label="Buscar por nome, SKU ou código de barras"
          value={search}
          maxLength={120}
          onChange={e => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </AppFiltersBar>
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,23rem)]">
        <section aria-label="Produtos em estoque" className="@container min-w-0">
          <ReadState query={products}>
            {products.data?.items.length === 0 ? (
              <AppEmptyState
                title="Nenhum produto encontrado"
                description="Cadastre cada variação com um SKU próprio. Registre a primeira entrada para formar o saldo."
              />
            ) : (
              <div className="grid gap-3 @min-[34rem]:grid-cols-2 @min-[52rem]:grid-cols-3">
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
                        {p.kind === "KIT" ? "Kit" : p.kind === "RAW_MATERIAL" ? "Matéria-prima" : p.kind === "PARENT" ? "Produto pai" : p.variant || "Produto simples"}
                        {p.barcode ? ` · ${p.barcode}` : ""}
                      </p>
                    </div>
                    {p.kind === "PARENT" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => productForm.start({
                            ...productDefaults,
                            kind: "VARIANT",
                            parentSku: p.sku,
                            name: p.name,
                          })}
                        >
                          Adicionar variação
                        </Button>
                        <Button variant="outline" onClick={() => { setSearch(p.sku); setPage(1); }}>
                          Buscar variações
                        </Button>
                      </div>
                    ) : p.kind === "KIT" ? (
                      <div className="grid gap-2">
                        <p><strong>{p.availableKits ?? 0}</strong> kits disponíveis</p>
                        <p className={muted}>Preço de venda: {money(p.saleCents, p.currency)}</p>
                        <ul aria-label="Composição do kit" className="grid gap-1 text-sm">
                          {(p.components ?? []).map(component => (
                            <li key={component.sku} className="break-words">
                              {component.quantity} × {component.sku} · {component.name}
                            </li>
                          ))}
                        </ul>
                        <Button variant="outline" className="justify-self-start"
                          disabled={!p.availableKits}
                          onClick={() => kitWithdrawalForm.start({ kitId: p.id, quantity: "1", reason: "" })}
                        >
                          Registrar saída do kit
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-end justify-between gap-2">
                          <p>
                            <strong className="text-3xl tabular-nums">
                              {stockQuantity(p.onHand, p.rawMaterialUnit)}
                            </strong>{" "}
                            <span className={muted}>{p.rawMaterialUnit ? materialUnitLabels[p.rawMaterialUnit] : "unidades"}</span>
                          </p>
                          <span className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-xs">
                            {p.onHand - p.reservedQuantity <= p.minQuantity ? "Repor estoque" : "Disponível"}
                          </span>
                        </div>
                        <dl className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <dt className={muted}>{p.rawMaterialUnit ? `Custo por ${materialUnitLabels[p.rawMaterialUnit]}` : "Custo unitário"}</dt>
                            <dd>{money(p.costCents, p.currency)}</dd>
                          </div>
                          {!p.rawMaterialUnit && <div>
                            <dt className={muted}>Preço de venda</dt>
                            <dd>{money(p.saleCents, p.currency)}</dd>
                          </div>}
                        </dl>
                        {p.reservedQuantity > 0 && (
                          <p className={muted}>{p.reservedQuantity} reservadas · {p.onHand - p.reservedQuantity} disponíveis</p>
                        )}
                        <p className={muted}>Estoque mínimo: {stockQuantity(p.minQuantity, p.rawMaterialUnit)}{p.rawMaterialUnit ? ` ${materialUnitLabels[p.rawMaterialUnit]}` : ""}</p>
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
                      </>
                    )}
                  </article>
                ))}
              </div>
            )}
            {products.data && (page > 1 || products.data.pages > 1) ? (
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
        </section>
        <section className={`${panel} space-y-3`}>
          <h2 className="text-lg font-semibold">Últimas movimentações</h2>
          <ReadState query={movements}>
            {movements.data?.length === 0 ? (
              <p className={muted}>Nenhuma entrada ou saída registrada.</p>
            ) : (
              <ol className="divide-y divide-[var(--border-subtle)]">
                {movements.data?.map(m => (
                  <li key={m.id} className="space-y-1 py-3">
                    <strong className="break-words">
                      {m.direction === "IN" ? "+" : "−"}
                      {stockQuantity(m.quantity, m.product?.rawMaterialUnit)}{m.product?.rawMaterialUnit ? ` ${materialUnitLabels[m.product.rawMaterialUnit]}` : ""} · {m.product?.name ?? "Produto"}
                    </strong>
                    <p className={`${muted} break-words`}>{m.reason}</p>
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
            Até 50 movimentações recentes.
          </p>
        </section>
      </div>
      <Editor
        form={productForm}
        title="Novo produto"
        submitLabel="Cadastrar produto"
      >
        <AppSelect
          ariaLabel="Tipo de produto"
          value={productForm.values.kind}
          onValueChange={value => productForm.edit("kind", value)}
          options={[
            { value: "SIMPLE", label: "Produto simples" },
            { value: "PARENT", label: "Produto pai com variações" },
            { value: "VARIANT", label: "Variação de um produto pai" },
            { value: "KIT", label: "Kit de produtos simples" },
            { value: "RAW_MATERIAL", label: "Matéria-prima" },
          ]}
        />
        {productForm.values.kind === "VARIANT" && (
          <Field
            label="SKU do produto pai"
            required
            pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,63}"
            maxLength={64}
            value={productForm.values.parentSku}
            onChange={e => productForm.edit("parentSku", e.target.value)}
          />
        )}
        <Field
          label={productForm.values.kind === "PARENT" ? "SKU de referência" : "SKU"}
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
        {productForm.values.kind === "KIT" ? (
          <>
            <Field label={`Preço de venda (${currency ?? "moeda da empresa"})`}
              required inputMode="decimal" value={productForm.values.sale}
              onChange={e => productForm.edit("sale", e.target.value)}
            />
            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium">Composição do kit</legend>
              {kitComponents.map((row, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-2">
                  <Field label={`SKU do componente ${index + 1}`} required maxLength={64}
                    value={row.sku} onChange={e => productForm.edit("components", JSON.stringify(
                      kitComponents.map((component, position) => position === index
                        ? { ...component, sku: e.target.value } : component)
                    ))}
                  />
                  <Field label={`Quantidade do componente ${index + 1}`} required inputMode="numeric"
                    value={row.quantity} onChange={e => productForm.edit("components", JSON.stringify(
                      kitComponents.map((component, position) => position === index
                        ? { ...component, quantity: e.target.value } : component)
                    ))}
                  />
                  {kitComponents.length > 1 && (
                    <Button type="button" variant="outline" className="justify-self-start"
                      onClick={() => productForm.edit("components", JSON.stringify(
                        kitComponents.filter((_, position) => position !== index)
                      ))}
                    >
                      Remover componente {index + 1}
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" className="justify-self-start" disabled={kitComponents.length >= 30}
                onClick={() => productForm.edit("components", JSON.stringify([...kitComponents, { sku: "", quantity: "1" }]))}
              >
                Adicionar componente
              </Button>
            </fieldset>
          </>
        ) : productForm.values.kind === "PARENT" ? (
          <p className={muted}>Cada variação terá seu próprio SKU e saldo.</p>
        ) : (
          <>
            <Field
              label="Código de barras (opcional)"
              maxLength={64}
              value={productForm.values.barcode}
              onChange={e => productForm.edit("barcode", e.target.value)}
            />
            {productForm.values.kind === "VARIANT" && (
              <Field
                label="Variação, como modelo, cor ou voltagem"
                required
                maxLength={100}
                value={productForm.values.variant}
                onChange={e => productForm.edit("variant", e.target.value)}
              />
            )}
            {materialForm && (
              <AppSelect
                ariaLabel="Unidade de medida"
                value={productForm.values.rawMaterialUnit}
                onValueChange={value => productForm.edit("rawMaterialUnit", value)}
                options={[
                  { value: "KG", label: "Quilograma (kg)" },
                  { value: "L", label: "Litro (L)" },
                  { value: "M", label: "Metro (m)" },
                ]}
              />
            )}
            <Field
              label={materialForm ? `Estoque mínimo (${formUnit})` : "Estoque mínimo (unidades inteiras)"}
              required
              inputMode={materialForm ? "decimal" : "numeric"}
              value={productForm.values.min}
              onChange={e => productForm.edit("min", e.target.value)}
            />
            <Field
              label={`${materialForm ? `Custo por ${formUnit}` : "Custo unitário"} (${currency ?? "moeda da empresa"})`}
              required
              inputMode="decimal"
              value={productForm.values.cost}
              onChange={e => productForm.edit("cost", e.target.value)}
            />
            {!materialForm && (
            <Field
              label={`Preço de venda (${currency ?? "moeda da empresa"})`}
              required
              inputMode="decimal"
              value={productForm.values.sale}
              onChange={e => productForm.edit("sale", e.target.value)}
            />
            )}
            <p className={muted}>
              O produto inicia sem saldo. Use Entrada para registrar a quantidade
              recebida.
            </p>
          </>
        )}
      </Editor>
      <Editor form={kitWithdrawalForm} title="Saída do kit" submitLabel="Confirmar saída">
        <Field label="Quantidade de kits" inputMode="numeric" required
          value={kitWithdrawalForm.values.quantity} onChange={e => kitWithdrawalForm.edit("quantity", e.target.value)}
        />
        <Field label="Motivo da saída" required minLength={3} maxLength={500}
          value={kitWithdrawalForm.values.reason} onChange={e => kitWithdrawalForm.edit("reason", e.target.value)}
        />
        <p className={muted}>A saída baixa os componentes conforme a composição.</p>
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
          label={movementUnit ? `Quantidade (${materialUnitLabels[movementUnit]})` : "Quantidade (unidades inteiras)"}
          required
          inputMode={movementUnit ? "decimal" : "numeric"}
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
      action={
        <Button onClick={() => form.start()}>
          <Plus className="mr-2 h-4 w-4" />
          Preparar nota
        </Button>
      }
    >
      <section className="space-y-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-3">
        <h2 className="text-sm font-semibold">Emissão fiscal indisponível</h2>
        <p className={muted}>
          Você pode salvar preparações aqui. Para emitir NFS-e, conecte um
          provedor fiscal e configure a tributação da empresa.
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
      action={
        <Button onClick={() => form.start()}>
          <Plus className="mr-2 h-4 w-4" />
          Registrar despesa
        </Button>
      }
    >
      <section
        className={`${panel} grid items-end gap-3 sm:grid-cols-[minmax(0,14rem)_1fr]`}
      >
        <Field
          label="Mês de análise"
          type="month"
          min="2000-01"
          max="9999-12"
          value={month || report.data?.month || ""}
          onChange={e => setMonth(e.target.value)}
        />
        <p className={`${muted} sm:pb-1`}>
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
        <div className="grid gap-4">
          {report.data?.currencies.map(r => (
            <section key={r.currency} className={`${panel} space-y-4`}>
              <h2 className="text-lg font-semibold">Resumo · {r.currency}</h2>
              <dl className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Recebido no mês", r.receivedCents],
                  ["Reembolsado no mês", r.refundedCents],
                  ["Despesas registradas", r.expensesCents],
                  ["Resultado dos registros", r.recordedResultCents],
                  ["A receber · carteira atual", r.openCents],
                  ["Em atraso · carteira atual", r.overdueCents],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"
                  >
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
