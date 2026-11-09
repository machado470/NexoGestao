import { describe, expect, it, vi } from "vitest";
import { completeOnboardingService } from "./onboarding-service";
const order = (status: string, version = "v1") => ({
  id: "order",
  status,
  updatedAt: version,
});
function actions() {
  return {
    existingId: null as string | null,
    assigneeId: "person",
    create: vi.fn(async () => order("ASSIGNED")),
    load: vi.fn(async () => order("IN_PROGRESS")),
    update: vi.fn(async (input: any) => order(input.status, input.status)),
    onCreated: vi.fn(),
  };
}
describe("onboarding service lifecycle", () => {
  it("starts then completes an assigned order with successive versions", async () => {
    const a = actions();
    expect((await completeOnboardingService(a)).status).toBe("DONE");
    expect(a.update.mock.calls.map(([input]) => input)).toEqual([
      { id: "order", status: "IN_PROGRESS", expectedUpdatedAt: "v1" },
      {
        id: "order",
        status: "DONE",
        expectedUpdatedAt: "IN_PROGRESS",
        outcomeSummary: "Serviço concluído durante onboarding guiado.",
      },
    ]);
  });
  it("retains the created id when starting fails and resumes without creating another order", async () => {
    const a = actions();
    a.update.mockRejectedValueOnce(new Error("lost response"));
    await expect(completeOnboardingService(a)).rejects.toThrow("lost response");
    expect(a.onCreated).toHaveBeenCalledWith("order");
    a.existingId = "order";
    await completeOnboardingService(a);
    expect(a.create).toHaveBeenCalledTimes(1);
    expect(a.load).toHaveBeenCalledWith("order");
    expect(a.update.mock.calls.at(-1)?.[0].status).toBe("DONE");
  });
  it("assigns an existing open order before starting it", async () => {
    const a = actions();
    a.existingId = "order";
    a.load.mockResolvedValue(order("OPEN"));
    await completeOnboardingService(a);
    expect(a.update.mock.calls.map(([input]) => input.status)).toEqual([
      "ASSIGNED",
      "IN_PROGRESS",
      "DONE",
    ]);
    expect(a.update.mock.calls[0][0].assignedToPersonId).toBe("person");
  });
  it("does not mutate an already completed order", async () => {
    const a = actions();
    a.existingId = "order";
    a.load.mockResolvedValue(order("DONE"));
    await completeOnboardingService(a);
    expect(a.update).not.toHaveBeenCalled();
    expect(a.create).not.toHaveBeenCalled();
  });
  it("does not write without a selected assignee", async () => {
    const a = actions();
    a.assigneeId = "";
    await expect(completeOnboardingService(a)).rejects.toThrow("responsável");
    expect(a.create).not.toHaveBeenCalled();
  });
  it("does not advance a canceled order", async () => {
    const a = actions();
    a.existingId = "order";
    a.load.mockResolvedValue(order("CANCELED"));
    await expect(completeOnboardingService(a)).rejects.toThrow(
      "não pode ser concluída"
    );
    expect(a.update).not.toHaveBeenCalled();
  });
});
