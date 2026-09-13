/** BullMQ custom job IDs cannot contain `:`. */
export function webhookDispatchJobId(deliveryId: string) {
  return `webhook-dispatch-${deliveryId}`
}

/** BullMQ custom job IDs cannot contain `:`. */
export function webhookDlqJobId(deliveryId: string) {
  return `webhook-dispatch-dlq-${deliveryId}`
}
