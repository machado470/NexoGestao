import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AppDataTable,
  AppEmptyState,
  AppKpiRow,
  AppLoadingState,
  AppPageHeader,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";

export default function WhatsAppPage() {
  const [location] = useLocation();
  const utils = trpc.useUtils();
  const search = new URLSearchParams(location.split("?")[1] ?? "");
  const queryCustomerId = search.get("customerId") ?? "";

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { retry: false });
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
  const failed = messages.filter((item) => String(item?.status ?? "").toUpperCase() === "FAILED").length;
  const delivered = messages.filter((item) => String(item?.status ?? "").toUpperCase() === "DELIVERED").length;

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

  return (
    <AppPageShell>
      <AppPageHeader
        title="WhatsApp Operacional"
        description="Envio real de mensagens com histórico de entrega e falhas."
        ctaLabel="Enviar mensagem"
        onCta={() => void sendMessage()}
      />

      <AppKpiRow
        items={[
          { label: "Mensagens", value: String(messages.length), trend: 0, context: "histórico do cliente" },
          { label: "Entregues", value: String(delivered), trend: 0, context: "status delivered" },
          { label: "Falhas", value: String(failed), trend: 0, context: "requer intervenção" },
          { label: "Clientes", value: String(customers.length), trend: 0, context: "com WhatsApp" },
        ]}
      />

      <AppSectionBlock title="Novo envio" subtitle="Selecione cliente e envie mensagem real no backend">
        {customers.length === 0 ? (
          <AppEmptyState title="Nenhum dado disponível ainda" description="Ação recomendada: criar cliente" />
        ) : (
          <div className="space-y-3">
            <select
              value={selectedCustomerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3"
            >
              {customers.map((customer) => (
                <option key={String(customer.id)} value={String(customer.id)}>{String(customer.name ?? "Cliente")}</option>
              ))}
            </select>
            <Input
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Digite a mensagem"
            />
            <Button onClick={() => void sendMessage()} disabled={sendMutation.isPending}>Enviar WhatsApp</Button>
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
    </AppPageShell>
  );
}
