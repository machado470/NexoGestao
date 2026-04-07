import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function useDemoEnvironment() {
  const utils = trpc.useUtils();

  const bootstrapDemo = trpc.nexo.demo.bootstrapLive.useMutation();
  const isGenerating = bootstrapDemo.isPending;

  const generateDemoEnvironment = async () => {
    try {
      const payload = await bootstrapDemo.mutateAsync();
      const data =
        payload && typeof payload === "object" && "data" in payload
          ? (payload as { data?: Record<string, unknown> }).data ?? payload
          : payload;

      await Promise.all([
        utils.dashboard.alerts.invalidate(),
        utils.nexo.customers.list.invalidate(),
        utils.nexo.appointments.list.invalidate(),
        utils.nexo.serviceOrders.list.invalidate(),
        utils.finance.charges.list.invalidate(),
        utils.finance.charges.stats.invalidate(),
        utils.nexo.timeline.listByOrg.invalidate(),
        utils.governance.summary.invalidate(),
        utils.governance.runs.invalidate(),
        utils.governance.autoScore.invalidate(),
        utils.nexo.whatsapp.messages.invalidate(),
      ]);

      const chain =
        data && typeof data === "object" && "chain" in (data as Record<string, unknown>)
          ? (data as Record<string, any>).chain
          : null;

      toast.success("Ambiente demo gerado com sucesso.");
      if (chain) {
        toast.message(
          `Fluxo oficial: O.S. ${chain.serviceOrderStatus} → cobrança ${chain.chargeStatus} → governança ${chain.governanceScore}.`
        );
      }

      return data;
    } catch (error: any) {
      const message =
        error?.message || "Falha ao gerar ambiente de demonstração.";
      toast.error(message);
      throw error;
    }
  };

  return {
    isGenerating,
    generateDemoEnvironment,
  };
}
