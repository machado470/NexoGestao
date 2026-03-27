import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export function useChargeActions(options: {
  navigate?: (path: string) => void;
  returnPath?: string;
}) {
  const [, navigateWouter] = useLocation();

  const navigate = options.navigate ?? navigateWouter;

  const utils = trpc.useUtils();

  // 🔥 CORREÇÃO AQUI
  const [location] = useLocation();

  const queryString =
    typeof location === "string" && location.includes("?")
      ? location.split("?")[1]
      : "";

  const payCharge = trpc.finance.charges.pay.useMutation({
    onSuccess: () => {
      utils.finance.charges.list.invalidate();
      utils.finance.charges.stats.invalidate();
    },
  });

  const registerPayment = async (charge: any, method: string) => {
    await payCharge.mutateAsync({
      chargeId: charge.id,
      method,
      amountCents: charge.amountCents,
    });
  };

  const generateCheckout = async (charge: any) => {
    navigate(`/finances?chargeId=${charge.id}`);
  };

  return {
    registerPayment,
    generateCheckout,
    isSubmitting: payCharge.isLoading,
  };
}
