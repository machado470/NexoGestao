import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationAccessSection } from "./OrganizationAccessSection";

const state = vi.hoisted(() => ({
  role: "ADMIN",
  query: {} as any,
  mutation: {} as any,
  useQuery: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true, role: state.role }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      invites: { members: { invalidate: state.invalidate } },
    }),
    invites: {
      members: {
        useQuery: (...args: unknown[]) => {
          state.useQuery(...args);
          return state.query;
        },
      },
      invite: { useMutation: () => state.mutation },
      resend: { useMutation: () => ({ isPending: false }) },
      revoke: { useMutation: () => ({ isPending: false }) },
    },
  },
}));
vi.mock("@/components/app-modal-system", () => ({ ConfirmModal: () => null }));
vi.mock("@/components/OrganizationMemberActions", () => ({
  OrganizationMemberActions: () => null,
}));
// Keep tests focused on access states and data rather than the styling primitives.
vi.mock("@/components/app-system", () => ({
  AppForm: ({ children, onSubmit }: any) => (
    <form onSubmit={onSubmit}>{children}</form>
  ),
  AppField: ({ children, label }: any) => (
    <label>
      {label}
      {children}
    </label>
  ),
  AppInput: (props: any) => <input {...props} />,
  AppSelect: ({ value, options, ariaLabel }: any) => (
    <select aria-label={ariaLabel} defaultValue={value}>
      {options.map((item: any) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("@/components/internal-page-system", () => ({
  AppSectionBlock: ({ children, title }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  AppPageLoadingState: ({ title }: any) => <p>{title}</p>,
  AppPageErrorState: ({ title }: any) => <p role="alert">{title}</p>,
}));

describe("organization access administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.role = "ADMIN";
    state.query = { data: { users: [], pendingInvites: [] } };
    state.mutation = { isPending: false, isError: false };
  });
  it("keeps cached members visible and offers refresh after a read failure", () => {
    state.query = {
      isError: true,
      data: {
        users: [
          {
            id: "cached",
            email: "cached@example.com",
            role: "STAFF",
            active: true,
          },
        ],
        pendingInvites: [],
      },
    };
    const html = renderToStaticMarkup(<OrganizationAccessSection />);
    expect(html).toContain("cached@example.com");
    expect(html).toContain("A lista exibida pode estar desatualizada");
    expect(html).toContain("Atualizar acessos");
    expect(html).not.toContain("Acessos indisponíveis");
  });
  it("does not expose access management or fetch member data to non-admins", () => {
    state.role = "MANAGER";
    expect(renderToStaticMarkup(<OrganizationAccessSection />)).toBe("");
    expect(state.useQuery).toHaveBeenCalledWith(undefined, {
      enabled: false,
      retry: false,
    });
  });
  it("shows real member roles and distinguishes pending invitations from inactive users", () => {
    state.query.data = {
      users: [
        { id: "1", email: "active@example.com", role: "ADMIN", active: true },
        { id: "2", email: "invited@example.com", role: "STAFF", active: false },
        {
          id: "3",
          email: "inactive@example.com",
          role: "VIEWER",
          active: false,
        },
      ],
      pendingInvites: [
        { id: "2", email: "invited@example.com", role: "STAFF" },
      ],
    };
    const html = renderToStaticMarkup(<OrganizationAccessSection />);
    expect(html).toContain("active@example.com");
    expect(html).toContain("Administrador · Ativo");
    expect(html).toContain("Operador · Convite pendente");
    expect(html).toContain("Leitura · Inativo");
    expect(html).toContain("Enviar convite");
  });
  it("renders server-provided expired and revoked invitation states without client clock rules", () => {
    state.query.data = {
      users: [
        {
          id: "expired",
          email: "expired@example.com",
          role: "STAFF",
          active: false,
        },
        {
          id: "revoked",
          email: "revoked@example.com",
          role: "VIEWER",
          active: false,
        },
      ],
      pendingInvites: [],
      invitations: [
        {
          id: "expired",
          email: "expired@example.com",
          role: "STAFF",
          status: "EXPIRED",
        },
        {
          id: "revoked",
          email: "revoked@example.com",
          role: "VIEWER",
          status: "REVOKED",
        },
      ],
    };
    const html = renderToStaticMarkup(<OrganizationAccessSection />);
    expect(html).toContain("Convite expirado");
    expect(html).toContain("Convite revogado");
    expect(html.match(/Reenviar convite/g)).toHaveLength(2);
    expect(html.match(/Revogar convite/g)).toHaveLength(1);
  });
  it("does not offer invitation mutations for an activated member", () => {
    state.query.data = {
      users: [
        {
          id: "active",
          email: "active@example.com",
          role: "ADMIN",
          active: true,
        },
      ],
      pendingInvites: [],
      invitations: [],
    };
    const html = renderToStaticMarkup(<OrganizationAccessSection />);
    expect(html).not.toContain("Reenviar convite");
    expect(html).not.toContain("Revogar convite");
  });
  it("does not present unavailable data as an empty organization", () => {
    state.query = { isError: true };
    const html = renderToStaticMarkup(<OrganizationAccessSection />);
    expect(html).toContain("Acessos indisponíveis");
    expect(html).not.toContain("Nenhum membro cadastrado");
    expect(html).not.toContain("Enviar convite");
  });
  it("shows loading explicitly", () => {
    state.query = { isLoading: true };
    expect(renderToStaticMarkup(<OrganizationAccessSection />)).toContain(
      "Carregando acessos"
    );
  });
  it("shows provider delivery errors and disables submission while sending", () => {
    state.mutation = {
      isError: true,
      error: { message: "Não foi possível enviar o convite." },
      isPending: true,
    };
    const html = renderToStaticMarkup(<OrganizationAccessSection />);
    expect(html).toContain("Não foi possível enviar o convite.");
    expect(html).toContain("Enviando...");
    expect(html).toContain("disabled");
  });
});
