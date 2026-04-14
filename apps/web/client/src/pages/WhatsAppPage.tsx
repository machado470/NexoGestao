import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { toast } from "sonner";
import { Button } from "@/components/design-system";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppDataTable,
  AppEmptyState,
  AppKpiRow,
  AppLoadingState,
  AppNextActionCard,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { formatDelta, getWindow, inRange, percentDelta, trendFromDelta } from "@/lib/operational/kpi";

export default function WhatsAppPage() {
  const safeDate = (value: unknown) => {
    if (!value) return null;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const [location] = useLocation();
  const utils = trpc.useUtils();
  const search = new URLSearchParams(location.split("?")[1] ?? "");
  const queryCustomerId = search.get("customerId") ?? "";

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { retry: false });
  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 100 }, { retry: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 100 }, { retry: false });
  const customers = useMemo(() => normalizeArrayPayload<any>(customersQuery.data), [customersQuery.data]);
  const [customerId, setCustomerId] = useState(queryCustomerId);
  const [content, setContent] = useState("");

  const selectedCustomerId = customerId || String(customers[0]?.id ?? "");
  const selectedCustomer = customers.find((item) => String(item?.id) === selectedCustomerId);

  const messagesQuery = trpc.nexo.whatsapp.messages.useQuery(
    { customerId: selectedCustomerId },
    { enabled: Boolean(selectedCustomerId), retry: false }
  );
  const sendMutation = trpc.nexo.whatsapp.send.useMutation();

  const messages = useMemo(() => normalizeArrayPayload<any>(messagesQuery.data), [messagesQuery.data]);
  const charges = useMemo(() => normalizeArrayPayload<any>(chargesQuery.data), [chargesQuery.data]);
  const serviceOrders = useMemo(() => normalizeArrayPayload<any>(serviceOrdersQuery.data), [serviceOrdersQuery.data]);
  const failed = messages.filter((item) => String(item?.status ?? "").toUpperCase() === "FAILED").length;
  const delivered = messages.filter((item) => String(item?.status ?? "").toUpperCase() === "DELIVERED").length;
  const current7 = getWindow(7, 0);
  const previous7 = getWindow(7, 1);
  const current7Messages = messages.filter(item => inRange(safeDate(item?.createdAt), current7.start, current7.end));
  const previous7Messages = messages.filter(item => inRange(safeDate(item?.createdAt), previous7.start, previous7.end));
  const current7DeliveryRate = current7Messages.length === 0 ? 0 : (current7Messages.filter(item => String(item?.status ?? "").toUpperCase() === "DELIVERED").length / current7Messages.length) * 100;
  const previous7DeliveryRate = previous7Messages.length === 0 ? 0 : (previous7Messages.filter(item => String(item?.status ?? "").toUpperCase() === "DELIVERED").length / previous7Messages.length) * 100;
  usePageDiagnostics({
    page: "whatsapp",
    isLoading: messagesQuery.isLoading,
    hasError: Boolean(messagesQuery.error),
    isEmpty: !messagesQuery.isLoading && !messagesQuery.error && messages.length === 0,
    dataCount: messages.length,
  });

  const automationSuggestions = useMemo(() => {
    const now = Date.now();
    const items: Array<{ id: string; customerId: string; title: string; reason: string; impact: string; urgency: string; preview: string }> = [];

    for (const charge of charges) {
      if (String(charge?.status ?? "").toUpperCase() !== "OVERDUE") continue;
      const cid = String(charge?.customerId ?? "");
      const customer = customers.find(item => String(item?.id) === cid);
      if (!cid || !customer?.phone) continue;
      const value = Number(charge?.amountCents ?? 0) / 100;
      items.push({
        id: `overdue-${String(charge?.id ?? cid)}`,
        customerId: cid,
        title: `Cobrança vencida · ${String(customer?.name ?? "Cliente")}`,
        reason: "Cobrança vencida detectada",
        impact: value > 0 ? `Impacto financeiro: R$ ${value.toFixed(2)}` : "Impacto financeiro imediato",
        urgency: "Urgência: alta",
        preview: `Olá, identificamos cobrança em aberto. Podemos regularizar hoje para evitar bloqueios?`,
      });
    }

    for (const order of serviceOrders) {
      const status = String(order?.status ?? "").toUpperCase();
      if (status !== "OVERDUE" && status !== "AT_RISK") continue;
      const cid = String(order?.customerId ?? "");
      const customer = customers.find(item => String(item?.id) === cid);
      if (!cid || !customer?.phone) continue;
      items.push({
        id: `so-delay-${String(order?.id ?? cid)}`,
        customerId: cid,
        title: `Atraso de O.S. · ${String(customer?.name ?? "Cliente")}`,
        reason: "Ordem em atraso operacional",
        impact: "Impacto em SLA e retenção",
        urgency: "Urgência: alta",
        preview: "Atualização rápida: sua O.S. está em prioridade máxima e enviamos novo horário estimado.",
      });
    }

    for (const customer of customers) {
      const cid = String(customer?.id ?? "");
      if (!cid || !customer?.phone) continue;
      const lastContact = safeDate(customer?.lastContactAt);
      if (lastContact && now - lastContact.getTime() < 1000 * 60 * 60 * 24 * 14) continue;
      items.push({
        id: `no-contact-${cid}`,
        customerId: cid,
        title: `Cliente sem contato · ${String(customer?.name ?? "Cliente")}`,
        reason: "Sem interação recente",
        impact: "Oportunidade de reativação",
        urgency: "Urgência: média",
        preview: "Passando para confirmar se está tudo bem e se você precisa de algum suporte nesta semana.",
      });
    }

    return items.slice(0, 6);
  }, [charges, customers, serviceOrders]);
  const lastMessage = messages[0];
  const selectedCustomerMessages = messages.filter(item => String(item?.customerId ?? selectedCustomerId) === selectedCustomerId);
  const nextSuggestedAction = failed > 0 ? "Reenviar mensagens com falha" : automationSuggestions.length > 0 ? "Executar automação sugerida" : "Enviar follow-up de relacionamento";

  async function sendMessage() {
    if (!selectedCustomerId || content.trim().length < 2) {
      toast.error("Falha ao enviar mensagem: selecione cliente e preencha o conteúdo");
      return;
    }
    const phone = String(selectedCustomer?.phone ?? "").replace(/\D/g, "");
    if (phone.length < 10) {
      toast.error("Cliente sem número válido para WhatsApp");
      return;
    }

    try {
      await sendMutation.mutateAsync({
        customerId: selectedCustomerId,
        content: content.trim(),
        idempotencyKey: buildIdempotencyKey("whatsapp.manual_send", selectedCustomerId),
      });
      setContent("");
      toast.success("Mensagem enviada com sucesso");
      await Promise.all([
        messagesQuery.refetch(),
        invalidateOperationalGraph(utils, selectedCustomerId),
      ]);
    } catch (error: any) {
      toast.error(error?.message || "Falha ao enviar mensagem");
    }
  }

  async function executeSuggestedMessage(customerIdToSend: string, preview: string) {
    setCustomerId(customerIdToSend);
    setContent(preview);
    await sendMutation.mutateAsync({
      customerId: customerIdToSend,
      content: preview,
      idempotencyKey: buildIdempotencyKey("whatsapp.automation_send", customerIdToSend),
    });
    toast.success("Automação executada com 1 clique.");
    await Promise.all([messagesQuery.refetch(), invalidateOperationalGraph(utils, customerIdToSend)]);
  }

  return (
    <PageWrapper title="WhatsApp Operacional" subtitle="Comunicação operacional no mesmo contrato de ação das demais áreas.">
      <OperationalTopCard
        contextLabel="Direção de comunicação"
        title="Envio e rastreio de mensagens"
        description="Envio real de mensagens com histórico de entrega e falhas."
        primaryAction={(
          <Button type="button" onClick={() => void sendMessage()} disabled={sendMutation.isPending}>
            Enviar mensagem
          </Button>
        )}
      />

      <AppKpiRow
        items={[
          {
            title: "Mensagens enviadas",
            value: String(messages.length),
            delta: formatDelta(percentDelta(current7Messages.length, previous7Messages.length)),
            trend: trendFromDelta(percentDelta(current7Messages.length, previous7Messages.length)),
            hint: "7 dias vs período anterior",
          },
          {
            title: "Taxa de entrega",
            value: `${current7DeliveryRate.toFixed(1).replace(".", ",")}%`,
            delta: formatDelta(percentDelta(current7DeliveryRate, previous7DeliveryRate)),
            trend: trendFromDelta(percentDelta(current7DeliveryRate, previous7DeliveryRate)),
            hint: "mensagens entregues / enviadas (7d)",
          },
          { title: "Conversas com falha", value: String(failed), hint: "status FAILED" },
          { title: "Follow-ups pendentes", value: String(automationSuggestions.length), hint: "gatilhos prontos para ação" },
        ]}
      />

      <AppSectionBlock title="Novo envio" subtitle="Selecione cliente e envie mensagem real no backend">
        {customers.length === 0 ? (
          <AppEmptyState title="Nenhum dado disponível ainda" description="Ação recomendada: criar cliente" />
        ) : (
          <div className="space-y-3">
            <Select value={selectedCustomerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
              {customers.map((customer) => (
                <SelectItem key={String(customer.id)} value={String(customer.id)}>
                  {String(customer.name ?? "Cliente")}
                </SelectItem>
              ))}
              </SelectContent>
            </Select>
            <Input
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Digite a mensagem"
            />
            <Button onClick={() => void sendMessage()} disabled={sendMutation.isPending}>Enviar WhatsApp</Button>
          </div>
        )}
      </AppSectionBlock>

      <div className="grid gap-3 xl:grid-cols-2">
        <AppSectionBlock title="Contexto do cliente selecionado" subtitle="Base para comunicação contextual">
          {selectedCustomer ? (
            <div className="space-y-1 text-sm text-[var(--text-secondary)]">
              <p><span className="text-[var(--text-muted)]">Cliente:</span> {String(selectedCustomer?.name ?? "—")}</p>
              <p><span className="text-[var(--text-muted)]">Telefone:</span> {String(selectedCustomer?.phone ?? "—")}</p>
              <p><span className="text-[var(--text-muted)]">Última interação:</span> {lastMessage?.createdAt ? new Date(String(lastMessage.createdAt)).toLocaleString("pt-BR") : "Sem histórico"}</p>
              <p><span className="text-[var(--text-muted)]">Mensagens no histórico:</span> {selectedCustomerMessages.length}</p>
            </div>
          ) : (
            <AppEmptyState title="Selecione um cliente" description="Escolha um cliente para carregar histórico e contexto de comunicação." />
          )}
        </AppSectionBlock>
        <AppNextActionCard
          title="Próxima ação sugerida"
          action={nextSuggestedAction}
          reason="Combina status de envio, histórico do cliente e gatilhos operacionais."
          onExecute={() => {
            if (automationSuggestions[0]) {
              void executeSuggestedMessage(automationSuggestions[0].customerId, automationSuggestions[0].preview);
              return;
            }
            void sendMessage();
          }}
          ctaLabel="Executar ação"
        />
      </div>

      <AppSectionBlock title="Automações sugeridas pela engine" subtitle="Problema detectado → ação pronta com pré-visualização e envio em 1 clique">
        {automationSuggestions.length === 0 ? (
          <AppEmptyState title="Sem gatilhos automáticos agora" description="Operação estável: nenhuma cobrança vencida, atraso de O.S. ou cliente sem contato crítico." />
        ) : (
          <div className="space-y-2">
            {automationSuggestions.map((item) => (
              <div key={item.id} className="rounded-lg border border-[var(--border-subtle)] p-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                <p className="text-xs text-[var(--text-muted)]">{item.reason}</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.impact} · {item.urgency}</p>
                <p className="mt-2 rounded bg-[var(--surface-elevated)] p-2 text-xs text-[var(--text-secondary)]">Prévia: {item.preview}</p>
                <Button className="mt-2" onClick={() => void executeSuggestedMessage(item.customerId, item.preview)} disabled={sendMutation.isPending}>
                  Executar envio automático
                </Button>
              </div>
            ))}
          </div>
        )}
      </AppSectionBlock>

      <AppSectionBlock title="Histórico de mensagens" subtitle="Status reais retornados pela API">
        {messagesQuery.isLoading ? (
          <AppLoadingState rows={4} />
        ) : messages.length === 0 ? (
          <AppEmptyState title="Nenhum dado disponível ainda" description="Ação recomendada: enviar WhatsApp" />
        ) : (
          <AppDataTable>
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="p-3">Conteúdo</th>
                  <th>Status</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <tr key={String(message?.id)} className="border-t border-[var(--border-subtle)]">
                    <td className="p-3">{String(message?.content ?? "—")}</td>
                    <td><AppStatusBadge label={String(message?.status ?? "Pendente")} /></td>
                    <td>{message?.createdAt ? new Date(String(message.createdAt)).toLocaleString("pt-BR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AppDataTable>
        )}
      </AppSectionBlock>
    </PageWrapper>
  );
}
