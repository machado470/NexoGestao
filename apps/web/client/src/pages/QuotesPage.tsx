import { useLocation } from "wouter";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { transientReadOptions } from "@/lib/read-query-retry";
import { useAuth } from "@/contexts/AuthContext";
import { can } from "@/lib/rbac";
import { useOrganizationLocale } from "@/contexts/OrganizationLocaleContext";
import { formatOrganizationDate } from "@/lib/organization-locale";
import { parseMoneyInputToCents } from "@/lib/money-input";
import { useFormDiscardGuard } from "@/hooks/useFormDiscardGuard";
import { FormModal } from "@/components/app-modal-system";
import {
  AppPageShell,
  AppSelect,
  AppEmptyState,
} from "@/components/app-system";
import {
  AppPageHeader,
  AppPageLoadingState,
  AppPageErrorState,
} from "@/components/internal-page-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuoteSummary, quoteMoney } from "@/components/QuoteSummary";
import type { QuoteRecord, QuoteConversion } from "@shared/service-quotes";
const panel =
    "min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4",
  muted = "text-sm text-[var(--text-muted)]";
const labels = {
  DRAFT: "Rascunho",
  SHARED: "Compartilhado",
  ACCEPTED: "Aprovado por link",
  REJECTED: "Recusado por link",
};
type Line = {
  serviceId: string;
  serviceVersion: number;
  name: string;
  quantity: string;
  price: string;
};
function QuoteEditor({
  item,
  onClose,
}: {
  item: QuoteRecord | null;
  onClose: () => void;
}) {
  const { currency } = useOrganizationLocale(),
    utils = trpc.useUtils();
  const [title, setTitle] = useState(item?.snapshot.title ?? ""),
    [conditions, setConditions] = useState(item?.snapshot.conditions ?? ""),
    [customerId, setCustomerId] = useState(item?.customerId ?? ""),
    [customerName, setCustomerName] = useState(item?.customerName ?? ""),
    [customerSearch, setCustomerSearch] = useState(""),
    [serviceSearch, setServiceSearch] = useState(""),
    [reason, setReason] = useState(""),
    [lines, setLines] = useState<Line[]>(
      () =>
        item?.snapshot.items.map(x => ({
          serviceId: x.serviceId,
          serviceVersion: x.serviceVersion,
          name: x.name,
          quantity: String(x.quantity),
          price: (x.unitCents / 100).toFixed(2).replace(".", ","),
        })) ?? []
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const initial = useRef(
      JSON.stringify({ title, conditions, customerId, lines })
    ),
    draftCurrency = useRef(item?.snapshot.currency ?? currency ?? ""),
    keys = useRef(new Map<string, string>()),
    lock = useRef(false);
  const guard = useFormDiscardGuard({
    open: true,
    dirty:
      Boolean(reason) ||
      JSON.stringify({ title, conditions, customerId, lines }) !==
        initial.current,
    blocked: busy,
    onDiscard: onClose,
    guardNavigation: true,
  });
  const customers = trpc.customers.page.useQuery(
    { page: 1, limit: 20, search: customerSearch, active: "active" },
    { ...transientReadOptions, enabled: !item }
  );
  const services = trpc.serviceCatalog.list.useQuery(
      { page: 1, q: serviceSearch, state: "active" },
      transientReadOptions
    ),
    create = trpc.serviceQuotes.create.useMutation(),
    revise = trpc.serviceQuotes.revise.useMutation();
  const customerOptions = (customers.data?.items ?? []).map(x => ({
    value: x.id,
    label: x.name,
  }));
  if (customerId && !customerOptions.some(x => x.value === customerId))
    customerOptions.unshift({ value: customerId, label: customerName });
  function updateLine(index: number, key: "price" | "quantity", value: string) {
    setLines(prev =>
      prev.map((x, i) => (i === index ? { ...x, [key]: value } : x))
    );
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    setError("");
    try {
      if (!draftCurrency.current || !customerId)
        throw new Error("Selecione o cliente e aguarde a moeda do orçamento.");
      const items = lines.map(x => {
        const raw = x.price.trim(),
          unitCents = /^0([,.]0{1,2})?$/.test(raw)
            ? 0
            : parseMoneyInputToCents(raw),
          quantity = /^\d+$/.test(x.quantity) ? Number(x.quantity) : NaN;
        if (
          unitCents === null ||
          unitCents > 2147483647 ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 1000
        )
          throw new Error(
            "Informe o preço de cada item e uma quantidade inteira de 1 a 1000."
          );
        return {
          serviceId: x.serviceId,
          serviceVersion: x.serviceVersion,
          quantity,
          unitCents,
        };
      });
      if (items.length < 1) throw new Error("Adicione ao menos um serviço.");
      const values = {
        title: title.trim(),
        conditions: conditions.trim(),
        expectedCurrency: draftCurrency.current,
        items,
      };
      lock.current = true;
      setBusy(true);
      if (item)
        await revise.mutateAsync({
          ...values,
          id: item.id,
          expectedVersion: item.version,
          reason: reason.trim(),
        });
      else {
        const fingerprint = JSON.stringify({ ...values, customerId });
        let entryKey = keys.current.get(fingerprint);
        if (!entryKey) {
          entryKey = crypto.randomUUID();
          keys.current.set(fingerprint, entryKey);
        }
        await create.mutateAsync({ ...values, customerId, entryKey });
        keys.current.delete(fingerprint);
      }
      void utils.serviceQuotes.invalidate();
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar. Seus dados continuam no formulário."
      );
      void utils.serviceQuotes.invalidate();
      void utils.serviceCatalog.list.invalidate();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      {guard.confirmation}
      <FormModal
        open
        onOpenChange={next => {
          if (!next) guard.requestClose();
        }}
        closeBlocked={busy}
        title={item ? "Revisar orçamento" : "Novo orçamento"}
        description={
          item
            ? "A revisão preserva o histórico e revoga links pendentes da versão anterior."
            : "Revise os serviços, preços e condições antes de compartilhar com o cliente."
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
            <Button
              type="submit"
              form="quote-editor"
              disabled={busy || !draftCurrency.current}
            >
              {busy ? "Salvando..." : "Salvar orçamento"}
            </Button>
          </>
        }
      >
        <form
          id="quote-editor"
          onSubmit={submit}
          className="grid min-w-0 gap-3"
        >
          <fieldset disabled={busy} className="grid min-w-0 gap-3">
            {!item && (
              <>
                <label htmlFor="quote-customer-search">Buscar cliente</label>
                <Input
                  id="quote-customer-search"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  maxLength={120}
                />
                {customers.isLoading ? (
                  <p className={muted}>Consultando clientes...</p>
                ) : customers.isError ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void customers.refetch()}
                  >
                    Tentar consultar clientes
                  </Button>
                ) : (
                  <AppSelect
                    ariaLabel="Cliente do orçamento"
                    value={customerId || "none"}
                    onValueChange={v => {
                      setCustomerId(v === "none" ? "" : v);
                      setCustomerName(
                        customerOptions.find(x => x.value === v)?.label ?? ""
                      );
                    }}
                    options={[
                      { value: "none", label: "Selecione o cliente" },
                      ...customerOptions,
                    ]}
                  />
                )}
                <p className={muted}>
                  Exibindo até 20 clientes ativos da busca. Cadastre novos
                  clientes na página Clientes.
                </p>
              </>
            )}
            {item && (
              <p className="break-words text-sm">
                Cliente: {item.customerName}
              </p>
            )}
            <label htmlFor="quote-title">Título do orçamento</label>
            <Input
              id="quote-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={140}
            />
            <label htmlFor="quote-service-search">
              Buscar serviço no catálogo
            </label>
            <Input
              id="quote-service-search"
              value={serviceSearch}
              onChange={e => setServiceSearch(e.target.value)}
              maxLength={120}
            />
            {services.isError ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void services.refetch()}
              >
                Tentar consultar serviços
              </Button>
            ) : services.isLoading ? (
              <p className={muted}>Consultando serviços...</p>
            ) : (
              <AppSelect
                ariaLabel="Adicionar serviço ao orçamento"
                value="none"
                onValueChange={v => {
                  const source = services.data?.items.find(x => x.id === v);
                  if (source && lines.length < 10)
                    setLines(prev => [
                      ...prev,
                      {
                        serviceId: source.id,
                        serviceVersion: source.version,
                        name: source.name,
                        quantity: "1",
                        price:
                          source.priceCents === null
                            ? ""
                            : (source.priceCents / 100)
                                .toFixed(2)
                                .replace(".", ","),
                      },
                    ]);
                }}
                options={[
                  {
                    value: "none",
                    label:
                      lines.length >= 10
                        ? "Limite de 10 itens"
                        : "Selecione um serviço para adicionar",
                  },
                  ...(services.data?.items ?? [])
                    .filter(x => x.currency === draftCurrency.current)
                    .map(x => ({
                      value: x.id,
                      label:
                        x.name +
                        " · " +
                        (x.priceCents === null
                          ? "Sob consulta"
                          : quoteMoney(x.priceCents, x.currency)),
                    })),
                ]}
              />
            )}
            <p className={muted}>
              Até 20 serviços da busca, na moeda {draftCurrency.current}. Preço
              sob consulta precisa ser preenchido. Para atualizar um item que
              mudou no catálogo, remova-o e adicione novamente.
            </p>
            {lines.map((line, index) => (
              <div
                key={index}
                className="grid min-w-0 gap-2 rounded-xl border border-[var(--border-subtle)] p-3"
              >
                <p className="break-words font-medium">
                  {index + 1}. {line.name}
                </p>
                <label htmlFor={"quote-quantity-" + index}>Quantidade</label>
                <Input
                  id={"quote-quantity-" + index}
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={e => updateLine(index, "quantity", e.target.value)}
                  required
                />
                <label htmlFor={"quote-price-" + index}>
                  Preço unitário ({draftCurrency.current})
                </label>
                <Input
                  id={"quote-price-" + index}
                  inputMode="decimal"
                  value={line.price}
                  onChange={e => updateLine(index, "price", e.target.value)}
                  required
                  placeholder="Informe o preço"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setLines(prev => prev.filter((_, i) => i !== index))
                  }
                >
                  Remover item {index + 1}
                </Button>
              </div>
            ))}
            <label htmlFor="quote-conditions">
              Condições que serão compartilhadas
            </label>
            <textarea
              id="quote-conditions"
              value={conditions}
              onChange={e => setConditions(e.target.value)}
              required
              minLength={10}
              maxLength={3000}
              className="min-h-32 rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] p-3 text-base text-[var(--field-text)]"
            />
            <p className={muted}>
              Descreva escopo, pagamento, prazo e condições aplicáveis. O
              servidor calcula o total pelos itens; impostos, descontos e
              cobrança não são automáticos.
            </p>
            {item && (
              <>
                <label htmlFor="quote-reason">Motivo da revisão</label>
                <textarea
                  id="quote-reason"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  required
                  minLength={10}
                  maxLength={1000}
                  className="min-h-24 rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] p-3 text-base text-[var(--field-text)]"
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
    </>
  );
}
function QuoteDetails({
  id,
  onClose,
  onRevise,
  manage,
}: {
  id: string;
  onClose: () => void;
  onRevise: (item: QuoteRecord) => void;
  manage: boolean;
}) {
  const [, navigate] = useLocation();
  const [converted, setConverted] = useState<QuoteConversion | null>(null);
  const { timezone } = useOrganizationLocale(),
    utils = trpc.useUtils(),
    [page, setPage] = useState(1),
    [link, setLink] = useState<{ id: string; url: string } | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    lock = useRef(false),
    keys = useRef(new Map<string, string>());
  const query = trpc.serviceQuotes.detail.useQuery(
      { id, page },
      transientReadOptions
    ),
    convert = trpc.serviceQuotes.convert.useMutation(),
    share = trpc.serviceQuotes.share.useMutation(),
    revoke = trpc.serviceQuotes.revoke.useMutation();
  const quote = query.data?.quote;
  useEffect(() => {
    setLink(null);
  }, [quote?.version]);
  async function convertToOrder() {
    if (!quote || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await convert.mutateAsync({
        id,
        expectedVersion: quote.version,
      });
      setConverted(result);
      setNotice(
        "O.S. disponível. Nenhuma cobrança, mensagem ou agenda foi gerada."
      );
      void Promise.allSettled([
        utils.serviceQuotes.invalidate(),
        utils.serviceOrders.invalidate(),
        utils.customers.workspace.invalidate(),
        utils.dashboard.invalidate(),
        utils.people.operationalSummary.invalidate(),
        utils.timeline.invalidate(),
      ]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível criar ou recuperar a O.S."
      );
      void query.refetch();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function generate() {
    if (!quote || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const fingerprint = id + ":" + quote.version;
    let entryKey = keys.current.get(fingerprint);
    if (!entryKey) {
      entryKey = crypto.randomUUID();
      keys.current.set(fingerprint, entryKey);
    }
    try {
      const result = await share.mutateAsync({
        id,
        expectedVersion: quote.version,
        entryKey,
      });
      keys.current.delete(fingerprint);
      setLink({
        id: result.id,
        url: window.location.origin + "/quote-approval#" + result.token,
      });
      void utils.serviceQuotes.invalidate();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível gerar o link."
      );
      void query.refetch();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function revokeLink(linkId: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await revoke.mutateAsync({ id, linkId });
      if (link?.id === linkId) setLink(null);
      setNotice(
        "Acesso revogado. Uma resposta já registrada permanece no histórico."
      );
      void utils.serviceQuotes.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível revogar.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <FormModal
      open
      onOpenChange={next => {
        if (!next && !busy) onClose();
      }}
      closeBlocked={busy}
      title="Detalhe do orçamento"
      description={quote ? quote.customerName : undefined}
      footer={
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Fechar
        </Button>
      }
    >
      {query.isLoading ? (
        <AppPageLoadingState description="Consultando orçamento..." />
      ) : query.isError ? (
        <AppPageErrorState
          description="Não foi possível consultar o orçamento."
          onAction={() => void query.refetch()}
        />
      ) : (
        quote && (
          <div className="grid min-w-0 gap-4">
            <p className="text-sm">
              Versão {quote.version + 1} · {labels[quote.status]}
            </p>
            <QuoteSummary snapshot={quote.snapshot} />
            {(converted ?? quote.conversion) ? (
              <div className="grid min-w-0 gap-2 rounded-xl border border-[var(--border-subtle)] p-3">
                <p className="text-sm font-semibold">
                  O.S. vinculada a esta versão
                </p>
                <p className="break-words text-sm">
                  {(converted ?? quote.conversion)!.serviceOrder.title}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Criada por {(converted ?? quote.conversion)!.createdByName}
                </p>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    navigate(
                      "/service-orders?id=" +
                        (converted ?? quote.conversion)!.serviceOrderId
                    )
                  }
                >
                  Abrir O.S. vinculada
                </Button>
              </div>
            ) : manage && quote.status === "ACCEPTED" ? (
              <div className="grid gap-3">
                <p className="text-sm text-[var(--text-muted)]">
                  Cria uma única O.S. aberta, com cliente e valor aprovados, sem
                  responsável, agenda, cobrança ou mensagens. Usa o limite de
                  O.S. do plano. O total zero cria uma O.S. sem cobrança.
                </p>
                <Button disabled={busy} onClick={() => void convertToOrder()}>
                  {busy ? "Registrando..." : "Criar O.S. desta versão"}
                </Button>
              </div>
            ) : null}

            <p className={muted}>
              Aprovação por link com nome informado, sem identidade verificada
              ou assinatura digital. Nenhuma O.S., cobrança ou mensagem é gerada
              automaticamente.
            </p>
            {manage && quote.status !== "ACCEPTED" && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => onRevise(quote)}
              >
                Revisar orçamento
              </Button>
            )}
            {manage && ["DRAFT", "SHARED"].includes(quote.status) && (
              <>
                <p className={muted}>
                  Confira o conteúdo acima antes de gerar o link. Ele permite
                  responder por 72 horas; gerar outro revoga o anterior ainda
                  pendente.
                </p>
                <Button disabled={busy} onClick={() => void generate()}>
                  {busy ? "Registrando..." : "Gerar link de aprovação"}
                </Button>
              </>
            )}
            {link && (
              <div className="grid min-w-0 gap-2">
                <label htmlFor="quote-share-link">
                  Link privado do orçamento
                </label>
                <Input
                  id="quote-share-link"
                  readOnly
                  value={link.url}
                  onFocus={e => e.currentTarget.select()}
                />
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link.url);
                      setNotice(
                        "Link copiado. Compartilhe somente com o destinatário."
                      );
                    } catch {
                      setNotice(
                        "Selecione o campo para copiar o link manualmente."
                      );
                    }
                  }}
                >
                  Copiar link
                </Button>
              </div>
            )}
            {notice && (
              <p role="status" className="break-words text-sm">
                {notice}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="break-words text-sm text-[var(--danger)]"
              >
                {error}
              </p>
            )}
            <details>
              <summary className="min-h-11 cursor-pointer py-3 font-semibold">
                Respostas e acessos recentes
              </summary>
              <p className={muted}>
                Até 10 links recentes. Links expirados precisam ser
                substituídos; revogar acesso não apaga respostas.
              </p>
              {query.data?.approvals.map(x => (
                <div
                  key={x.id}
                  className="mt-3 grid min-w-0 gap-2 border-t border-[var(--border-subtle)] pt-3 text-sm"
                >
                  <p>
                    Versão {x.quoteVersion + 1} ·{" "}
                    {x.revokedAt
                      ? "Acesso revogado"
                      : x.decision
                        ? labels[x.decision]
                        : "Link gerado"}
                  </p>
                  <p className={muted}>
                    Expira: {formatOrganizationDate(x.expiresAt, timezone)}
                  </p>
                  {x.respondedAt && (
                    <p className="break-words">
                      Resposta por {x.respondentName} ·{" "}
                      {formatOrganizationDate(x.respondedAt, timezone)}
                    </p>
                  )}
                  {x.responseNote && (
                    <p className="whitespace-pre-wrap break-words">
                      {x.responseNote}
                    </p>
                  )}
                  {manage && !x.revokedAt && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void revokeLink(x.id)}
                    >
                      Revogar acesso ao link
                    </Button>
                  )}
                </div>
              ))}
            </details>
            <details>
              <summary className="min-h-11 cursor-pointer py-3 font-semibold">
                Histórico de versões
              </summary>
              {query.data?.revisions.map(x => (
                <div
                  key={x.version}
                  className="mt-3 grid min-w-0 gap-2 border-t border-[var(--border-subtle)] pt-3"
                >
                  <p className="break-words text-sm">
                    Versão {x.version + 1} · {x.actorName} ·{" "}
                    {formatOrganizationDate(x.createdAt, timezone)}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {x.reason}
                  </p>
                  <QuoteSummary snapshot={x.snapshot} />
                </div>
              ))}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1 || query.isFetching}
                  onClick={() => setPage(x => x - 1)}
                >
                  Anterior
                </Button>
                <span>
                  {page}/{query.data?.pages ?? 1}
                </span>
                <Button
                  variant="outline"
                  disabled={
                    page >= (query.data?.pages ?? 1) || query.isFetching
                  }
                  onClick={() => setPage(x => x + 1)}
                >
                  Próxima
                </Button>
              </div>
            </details>
          </div>
        )
      )}
    </FormModal>
  );
}
export default function QuotesPage() {
  const { role } = useAuth(),
    { currency } = useOrganizationLocale(),
    [page, setPage] = useState(1),
    [editor, setEditor] = useState<{ item: QuoteRecord | null } | null>(null),
    [selected, setSelected] = useState(
      () => new URLSearchParams(window.location.search).get("id") ?? ""
    ),
    [notice, setNotice] = useState("");
  const query = trpc.serviceQuotes.list.useQuery(
      { page },
      transientReadOptions
    ),
    manage = role ? can(role, "catalog:manage") : false;
  return (
    <AppPageShell className="operational-mobile-page mobile-module-page min-w-0 gap-4">
      <AppPageHeader
        title="Orçamentos"
        description="Combine escopo, valores e condições antes do serviço."
        actions={
          manage && (
            <Button
              className="min-h-11"
              disabled={!currency}
              onClick={() => setEditor({ item: null })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo orçamento
            </Button>
          )
        }
      />
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <p className={muted}>
        Versões preservam o combinado. Aprovação por link não gera O.S. nem
        cobrança nesta etapa.
      </p>
      {query.isLoading ? (
        <AppPageLoadingState description="Consultando orçamentos..." />
      ) : query.isError ? (
        <AppPageErrorState
          description="Não foi possível consultar os orçamentos."
          onAction={() => void query.refetch()}
        />
      ) : !query.data?.items.length ? (
        <AppEmptyState
          title="Nenhum orçamento registrado"
          description="Cadastre serviços no catálogo e crie a primeira proposta para um cliente."
        />
      ) : (
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {query.data.items.map(item => (
            <article
              key={item.id}
              aria-label={item.snapshot.title}
              className={panel}
            >
              <p className="break-words text-sm text-[var(--text-muted)]">
                {item.customerName} · Versão {item.version + 1}
              </p>
              <h2 className="mt-2 break-words text-lg font-semibold">
                {item.snapshot.title}
              </h2>
              <p className="mt-3 text-xl font-semibold">
                {quoteMoney(item.snapshot.totalCents, item.snapshot.currency)}
              </p>
              <p className="mt-2 text-sm">{labels[item.status]}</p>
              <Button
                variant="outline"
                className="mt-3 min-h-11"
                onClick={() => setSelected(item.id)}
              >
                Ver orçamento
              </Button>
            </article>
          ))}
        </div>
      )}
      {(page > 1 || (query.data?.pages ?? 1) > 1) && (
        <nav
          aria-label="Paginação de orçamentos"
          className="flex flex-wrap items-center gap-2"
        >
          <Button
            variant="outline"
            disabled={page <= 1 || query.isFetching}
            onClick={() => setPage(x => x - 1)}
          >
            Anterior
          </Button>
          <span>
            {page}/{query.data?.pages ?? 1}
          </span>
          <Button
            variant="outline"
            disabled={page >= (query.data?.pages ?? 1) || query.isFetching}
            onClick={() => setPage(x => x + 1)}
          >
            Próxima
          </Button>
        </nav>
      )}
      {selected && (
        <QuoteDetails
          key={selected}
          id={selected}
          onClose={() => setSelected("")}
          manage={manage}
          onRevise={item => {
            setSelected("");
            setEditor({ item });
          }}
        />
      )}
      {editor && (
        <QuoteEditor
          item={editor.item}
          onClose={() => {
            setEditor(null);
            setPage(1);
            setNotice("Confira os dados atualizados na lista de orçamentos.");
          }}
        />
      )}
    </AppPageShell>
  );
}
