import { beforeEach, describe, expect, it, vi } from "vitest";
import { invitesRouter } from "./routers/invites";
import { authedPost } from "./_core/nexoTransport";
vi.mock("./_core/nexoTransport", () => ({
  authedPost: vi.fn(),
  authedGet: vi.fn(),
}));
const id = "0ea2f508-23c7-4cdd-89f0-abc000000001";
const ctx = {
  user: { token: "session", validated: true, role: "ADMIN" },
  req: { headers: {} },
} as any;

describe("invitation lifecycle BFF", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["resend", "revoke"] as const)(
    "forwards %s using the authenticated context and identifier only",
    async action => {
      vi.mocked(authedPost).mockResolvedValue({ success: true });
      await invitesRouter
        .createCaller(ctx)
        [action]({ id, orgId: "foreign-org", role: "ADMIN" } as any);
      expect(authedPost).toHaveBeenCalledWith(
        ctx,
        `/auth/invites/${id}/${action}`
      );
    }
  );
  it.each(["resend", "revoke"] as const)(
    "rejects malformed %s targets before transport",
    async action => {
      await expect(
        invitesRouter.createCaller(ctx)[action]({ id: "../../other" })
      ).rejects.toThrow();
      expect(authedPost).not.toHaveBeenCalled();
    }
  );
  it.each(["resend", "revoke"] as const)(
    "rejects unauthenticated %s",
    async action => {
      await expect(
        invitesRouter
          .createCaller({ req: { headers: {} }, user: null } as any)
          [action]({ id })
      ).rejects.toThrow();
      expect(authedPost).not.toHaveBeenCalled();
    }
  );
});
