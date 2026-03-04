import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface StripeCheckoutProps {
  planId: "starter" | "professional" | "enterprise";
  billingCycle: "monthly" | "annual";
  planName: string;
  price: number;
}

export function StripeCheckout({
  planId,
  billingCycle,
  planName,
  price,
}: StripeCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const createCheckoutMutation = trpc.stripe.createCheckoutSession.useMutation();

  const handleCheckout = async () => {
    try {
      setLoading(true);

      // Get Stripe publishable key from environment
      const publishableKey =
        import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
        "pk_test_51T6iLcIIhtHijQjUYKGIp0RyW6mhRO1oSfU7DqGVNRM1aJyxWrS37WU3ETY2NDtiQbDDEE5KohQsOdiKG0PdlyoQ00hrFGFhXY";

      const stripe = await loadStripe(publishableKey);
      if (!stripe) {
        throw new Error("Failed to load Stripe");
      }

      // Create checkout session
      const { sessionId } = await createCheckoutMutation.mutateAsync({
        planId,
        billingCycle,
      });

      // Redirect to Stripe checkout
      if (sessionId) {
        window.location.href = `https://checkout.stripe.com/pay/${sessionId}`;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      const message =
        error instanceof Error ? error.message : "Erro ao processar pagamento";
      alert(`Erro: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCheckout}
      disabled={loading}
      className="w-full bg-orange-500 hover:bg-orange-600 text-white"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Processando...
        </>
      ) : (
        `Escolher ${planName}`
      )}
    </Button>
  );
}
