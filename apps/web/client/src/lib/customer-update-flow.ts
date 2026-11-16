export type CustomerUpdateOutcome<T> =
  | { status: "failed"; error: unknown }
  | { status: "saved"; customer: T; synchronized: boolean };

/** Only persistence failure leaves the edit retryable. Follow-up reads cannot undo it. */
export async function executeCustomerUpdate<T>(actions: {
  persist: () => Promise<T>;
  confirm: (customer: T) => void;
  synchronize: () => Promise<unknown>;
}): Promise<CustomerUpdateOutcome<T>> {
  let customer: T;
  try {
    customer = await actions.persist();
  } catch (error) {
    return { status: "failed", error };
  }
  // Include local confirmation in the post-commit boundary as well.
  try {
    actions.confirm(customer);
    await actions.synchronize();
    return { status: "saved", customer, synchronized: true };
  } catch {
    return { status: "saved", customer, synchronized: false };
  }
}
