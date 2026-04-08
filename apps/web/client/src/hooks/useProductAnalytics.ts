import { trpc } from "@/lib/trpc";

type ProductEventName =
  | "cta_click"
  | "create_customer"
  | "create_service_order"
  | "generate_charge"
  | "send_whatsapp"
  | "payment_registered"
  | "upgrade_click"
  | "checkout_started"
  | "checkout_completed";

type ProductEventMetadata = Record<string, unknown>;

export function useProductAnalytics() {
  const mutation = trpc.analytics.track.useMutation();

  const track = (eventName: ProductEventName, metadata: ProductEventMetadata = {}) => {
    void mutation.mutateAsync({
      eventName,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    });
  };

  return {
    track,
  };
}
