export type OnboardingServiceOrder = {
  id: string;
  status: string;
  updatedAt: string;
};
/** Resume the same order after a partial failure; every transition uses its latest version. */
export async function completeOnboardingService(actions: {
  existingId: string | null;
  assigneeId: string;
  create: () => Promise<OnboardingServiceOrder>;
  load: (id: string) => Promise<OnboardingServiceOrder>;
  update: (input: {
    id: string;
    status: "ASSIGNED" | "IN_PROGRESS" | "DONE";
    expectedUpdatedAt: string;
    assignedToPersonId?: string;
    outcomeSummary?: string;
  }) => Promise<OnboardingServiceOrder>;
  onCreated: (id: string) => void;
}): Promise<OnboardingServiceOrder> {
  if (!actions.assigneeId)
    throw new Error("Selecione o responsável pela execução.");
  let order = actions.existingId
    ? await actions.load(actions.existingId)
    : await actions.create();
  actions.onCreated(order.id);
  if (order.status === "OPEN")
    order = await actions.update({
      id: order.id,
      status: "ASSIGNED",
      assignedToPersonId: actions.assigneeId,
      expectedUpdatedAt: order.updatedAt,
    });
  if (order.status === "ASSIGNED")
    order = await actions.update({
      id: order.id,
      status: "IN_PROGRESS",
      expectedUpdatedAt: order.updatedAt,
    });
  if (order.status === "IN_PROGRESS")
    order = await actions.update({
      id: order.id,
      status: "DONE",
      expectedUpdatedAt: order.updatedAt,
      outcomeSummary: "Serviço concluído durante onboarding guiado.",
    });
  if (order.status !== "DONE")
    throw new Error(
      "Esta O.S. não pode ser concluída pelo onboarding. Revise-a em Ordens de serviço."
    );
  return order;
}
