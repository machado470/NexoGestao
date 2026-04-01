import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { buildFinanceChargeUrl } from "@/lib/operations/operations.utils";

type NavigateFn = (path: string) => void;

type PaymentMethod = "PIX" | "CASH" | "CARD" | "TRANSFER" | "OTHER";

type RefreshAction = () => void | Promise<unknown>;

type ChargeLike = {
  id: string;
  amountCents: number;
};

type UseChargeActionsOptions = {
  navigate?: NavigateFn;
  location?: string;
  returnPath?: string;
  refreshActions?: RefreshAction[];
};

function buildChargeFinancePath(chargeId: string, returnPath?: string) {
  const base = buildFinanceChargeUrl(chargeId);

  if (!returnPath) {
    return base;
  }

  const params = new URLSearchParams();
  params.set("chargeId", chargeId);
  params.set("returnTo", returnPath);

  return `/finances?${params.toString()}`;
}

export function useChargeActions(options?: UseChargeActionsOptions) {
  const [locationWouter, navigateWouter] = useLocation();

  const navigate = options?.navigate ?? navigateWouter;
  const location = options?.location ?? locationWouter;
  const returnPath = options?.returnPath ?? location ?? "/finances";
  const refreshActions = options?.refreshActions ?? [];

  const utils = trpc.useUtils();

  const runRefreshActions = async () => {
    for (const action of refreshActions) {
      try {
        await action();
      } catch (error) {
        console.error("[useChargeActions] refresh action failed", error);
      }
    }
  };

  const payCharge = trpc.finance.charges.pay.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.finance.charges.list.invalidate(),
        utils.finance.charges.stats.invalidate(),
      ]);

      await runRefreshActions();
    },
  });

  const registerPayment = async (charge: ChargeLike, method: PaymentMethod) => {
    await payCharge.mutateAsync({
      chargeId: charge.id,
      method,
      amountCents: charge.amountCents,
    });
  };

  const generateCheckout = async (charge: Pick<ChargeLike, "id"> | null | undefined) => {
    if (!charge?.id) {
      return;
    }

    navigate(buildChargeFinancePath(String(charge.id), returnPath));
  };

  return {
    registerPayment,
    generateCheckout,
    isSubmitting: payCharge.isPending,
  };
}
