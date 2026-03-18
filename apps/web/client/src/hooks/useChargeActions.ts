import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type RefreshAction = () => Promise<unknown> | unknown;

type UseChargeActionsParams = {
  location: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  returnPath: string;
  refreshActions?: RefreshAction[];
};

type ChargeLike = {
  id: string;
  customerId?: string | null;
  amountCents?: number | null;
  notes?: string | null;
  serviceOrder?: {
    title?: string | null;
  } | null;
};

export function useChargeActions({
  location,
  navigate,
  returnPath,
  refreshActions = [],
}: UseChargeActionsParams) {
  const utils = trpc.useUtils();

  const searchParams = useMemo(() => {
    const queryString = location.includes("?") ? location.split("?")[1] : "";
    return new URLSearchParams(queryString);
  }, [location]);

  const checkoutStatusFromUrl = searchParams.get("checkout")?.trim() || "";
  const checkoutChargeIdFromUrl = searchParams.get("chargeId")?.trim() || "";

  const payCharge = trpc.finance.charges.pay.useMutation({
    onSuccess: async () => {
      toast.success("Pagamento registrado com sucesso");
      await Promise.all([
        ...refreshActions.map((action) => Promise.resolve(action())),
        utils.finance.charges.list.invalidate(),
        utils.finance.charges.stats.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao registrar pagamento");
    },
  });

  const checkoutCharge = trpc.payments.checkout.useMutation({
    onError: (error) => {
      toast.error(error.message || "Erro ao gerar checkout");
    },
  });

  useEffect(() => {
    if (!checkoutStatusFromUrl) return;

    if (checkoutStatusFromUrl === "success") {
      toast.success(
        checkoutChargeIdFromUrl
          ? `Checkout concluído para cobrança ${checkoutChargeIdFromUrl.slice(0, 8)}.`
          : "Checkout concluído com sucesso."
      );

      void Promise.all([
        ...refreshActions.map((action) => Promise.resolve(action())),
        utils.finance.charges.list.invalidate(),
        utils.finance.charges.stats.invalidate(),
      ]);
    } else if (checkoutStatusFromUrl === "cancel") {
      toast.error(
        checkoutChargeIdFromUrl
          ? `Checkout cancelado para cobrança ${checkoutChargeIdFromUrl.slice(0, 8)}.`
          : "Checkout cancelado."
      );
    }

    navigate(returnPath, { replace: true });
  }, [
    checkoutStatusFromUrl,
    checkoutChargeIdFromUrl,
    navigate,
    returnPath,
    refreshActions,
    utils.finance.charges.list,
    utils.finance.charges.stats,
  ]);

  const registerPayment = async (charge: ChargeLike, method: "PIX" | "CASH" = "PIX") => {
    const amountCents = Number(charge?.amountCents ?? 0);

    if (!amountCents || amountCents <= 0) {
      toast.error("Valor da cobrança inválido para registrar pagamento");
      return;
    }

    await payCharge.mutateAsync({
      chargeId: String(charge.id),
      method,
      amountCents,
    });
  };

  const generateCheckout = async (charge: ChargeLike) => {
    const amountCents = Number(charge?.amountCents ?? 0);

    if (!amountCents || amountCents <= 0) {
      toast.error("Valor da cobrança inválido para checkout");
      return;
    }

    if (!charge?.customerId) {
      toast.error("Cobrança sem cliente vinculado");
      return;
    }

    const description =
      charge?.notes?.trim() ||
      charge?.serviceOrder?.title ||
      `Cobrança #${String(charge.id).slice(0, 8)}`;

    const origin = window.location.origin;

    const result = await checkoutCharge.mutateAsync({
      chargeId: String(charge.id),
      customerId: String(charge.customerId),
      amount: amountCents,
      description,
      successUrl: `${origin}${returnPath}?checkout=success&chargeId=${String(charge.id)}`,
      cancelUrl: `${origin}${returnPath}?checkout=cancel&chargeId=${String(charge.id)}`,
    });

    const checkoutUrl = result?.checkoutUrl;

    if (!checkoutUrl) {
      toast.error("Checkout retornado sem URL");
      return;
    }

    window.location.href = checkoutUrl;
  };

  return {
    checkoutStatusFromUrl,
    checkoutChargeIdFromUrl,
    registerPayment,
    generateCheckout,
    isSubmitting: payCharge.isPending || checkoutCharge.isPending,
    payCharge,
    checkoutCharge,
  };
}
