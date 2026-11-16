import { beforeEach, describe, expect, it, vi } from "vitest";
import { invitesRouter } from "./routers/invites";
import { authedPatch } from "./_core/nexoTransport";
vi.mock("./_core/nexoTransport", () => ({
  authedGet: vi.fn(),
  authedPost: vi.fn(),
  authedPatch: vi.fn(),
}));
const ctx = {
  user: { token: "session", validated: true, role: "ADMIN" },
  req: { headers: {} },
} as any;
const input = {
  id: "0ea2f508-23c7-4cdd-89f0-abc000000001",
  active: false,
  expectedUpdatedAt: "2026-11-08T12:00:00Z",
};
describe("member access BFF", () => {
  beforeEach(() => vi.clearAllMocks());
  it("forwards only supported access fields with optimistic versioning", async () => {
    await invitesRouter
      .createCaller(ctx)
      .updateMember({
        ...input,
        orgId: "foreign",
        actorUserId: "other",
        password: "ignored",
      } as any);
    expect(authedPatch).toHaveBeenCalledWith(
      ctx,
      `/auth/organization/members/${input.id}`,
      { active: false, expectedUpdatedAt: input.expectedUpdatedAt }
    );
  });
  it.each([
    { ...input, id: "../other" },
    { ...input, active: "false" },
    { ...input, role: "SUPERADMIN" },
    { ...input, expectedUpdatedAt: undefined },
    { id: input.id, expectedUpdatedAt: input.expectedUpdatedAt },
  ])(
    "rejects invalid identifiers, roles, states, versions and empty edits",
    async invalid => {
      await expect(
        invitesRouter.createCaller(ctx).updateMember(invalid as any)
      ).rejects.toThrow();
      expect(authedPatch).not.toHaveBeenCalled();
    }
  );
  it("requires a validated session", async () => {
    await expect(
      invitesRouter
        .createCaller({ user: null, req: { headers: {} } } as any)
        .updateMember(input)
    ).rejects.toThrow();
    expect(authedPatch).not.toHaveBeenCalled();
  });
});
