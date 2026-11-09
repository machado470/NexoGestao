import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OrganizationMemberActions,
  type AccessMember,
} from "./OrganizationMemberActions";
import { can } from "@/lib/rbac";
const state = vi.hoisted(() => ({ mutation: {} as any }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ invites: { members: { invalidate: vi.fn() } } }),
    invites: { updateMember: { useMutation: () => state.mutation } },
  },
}));
vi.mock("@/components/app-modal-system", () => ({
  FormModal: () => null,
  ConfirmModal: () => null,
}));
const member: AccessMember = {
  id: "member",
  email: "m@example.com",
  active: true,
  role: "STAFF",
  updatedAt: "2026-11-08T12:00:00Z",
  person: { name: "Ana" },
};
const render = (value = member, currentUserId = "admin") =>
  renderToStaticMarkup(
    <OrganizationMemberActions member={value} currentUserId={currentUserId} />
  );
describe("member access controls", () => {
  beforeEach(() => {
    state.mutation = { isPending: false, isError: false };
  });
  it("offers role and activation controls for an existing member", () => {
    expect(render()).toContain("Alterar papel");
    expect(render()).toContain("Desativar acesso");
    expect(render({ ...member, active: false })).toContain("Ativar acesso");
  });
  it("does not expose mutations for invitation-only or unversioned records", () => {
    expect(render({ ...member, person: null })).toBe("");
    expect(render({ ...member, updatedAt: undefined })).toBe("");
  });
  it("explains why the current administrator cannot change their own access", () => {
    const html = render(member, member.id);
    expect(html).toContain("outro administrador");
    expect(html).not.toContain("Desativar acesso");
  });
  it("disables actions during the mutation and displays persisted errors", () => {
    state.mutation = {
      isPending: true,
      isError: true,
      error: { message: "O acesso foi alterado. Atualize a lista." },
    };
    const html = render();
    expect(html).toContain("disabled");
    expect(html).toContain("Atualizando acesso...");
    expect(html).toContain("O acesso foi alterado");
  });
  it("reserves administrative settings for the role required by the API", () => {
    expect(can("ADMIN", "settings:manage")).toBe(true);
    for (const role of ["MANAGER", "STAFF", "VIEWER"] as const)
      expect(can(role, "settings:manage")).toBe(false);
  });
});
