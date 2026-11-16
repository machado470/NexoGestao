import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FinancesPage from "./FinancesPage";

const state = vi.hoisted(() => ({
  focused: {} as any,
  list: {} as any,
  getById: vi.fn(),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    finance: {
      charges: {
        getById: {
          useQuery: (...args: unknown[]) => {
            state.getById(...args);
            return state.focused;
          },
        },
        list: { useQuery: () => state.list },
        stats: { useQuery: () => ({ data: {} }) },
        pay: { useMutation: () => ({}) },
        cancel: { useMutation: () => ({}) },
      },
      operationalQueue: { useQuery: () => ({ data: [] }) },
    },
  },
}));
vi.mock("@/components/CreateChargeModal", () => ({
  CreateChargeModal: () => null,
}));
vi.mock("@/components/app-modal-system", () => ({ FormModal: () => null }));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock("@/components/internal-page-system", () => ({
  AppDataTable: ({ children }: any) => <table>{children}</table>,
  AppFiltersBar: ({ children }: any) => <div>{children}</div>,
  AppOperationalHeader: () => <h1>Financeiro</h1>,
  AppPageErrorState: ({ title, description }: any) => (
    <p role="alert">
      {title}
      {description}
    </p>
  ),
  AppPageLoadingState: ({ title }: any) => <p>{title}</p>,
  AppSectionBlock: ({ children, title }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));
vi.mock("@/components/app-system", () => {
  const Box = ({ children }: any) => <div>{children}</div>;
  return {
    AppAlert: Box,
    AppAlertDescription: Box,
    AppField: Box,
    AppFieldGroup: Box,
    AppForm: Box,
    AppFormActions: Box,
    AppInfoCard: Box,
    AppPageShell: Box,
    AppInput: () => null,
    AppSelect: () => null,
    AppStatusBadge: ({ label }: any) => <span>{label}</span>,
    AppEmptyState: ({ title }: any) => <p>{title}</p>,
  };
});
const render = (url: string) =>
  renderToStaticMarkup(
    <Router ssrPath={url}>
      <FinancesPage />
    </Router>
  );

describe("finance navigation with real Wouter query parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.focused = {
      data: {
        id: "old-charge",
        customer: { name: "Ana" },
        balanceCents: 7500,
        status: "PENDING",
      },
    };
    state.list = { data: [] };
  });
  it("loads the linked charge even when it is outside the current portfolio page", () => {
    const html = render("/finances?chargeId=old-charge");
    expect(state.getById).toHaveBeenCalledWith(
      { id: "old-charge" },
      { enabled: true, retry: false }
    );
    expect(html).toContain("Cobrança selecionada");
    expect(html).toContain("Ana");
    expect(html).toContain("Registrar pagamento");
  });
  it("keeps the linked record available independently of portfolio failure", () => {
    state.list = { isError: true, data: [] };
    expect(render("/finances?chargeId=old-charge")).toContain("Ana");
  });
  it("does not request a focused record without an identifier", () => {
    render("/finances");
    expect(state.getById).toHaveBeenCalledWith(
      { id: "" },
      { enabled: false, retry: false }
    );
  });
  it("shows inaccessible records explicitly and never substitutes another charge", () => {
    state.focused = { isError: true };
    const html = render("/finances?chargeId=foreign-charge&action=pay");
    expect(html).toContain("Cobrança indisponível");
    expect(html).not.toContain("Registrar pagamento");
  });
  it("filters customer links by exact customer identity", () => {
    state.list.data = [
      {
        id: "a",
        customerId: "customer-a",
        customer: { name: "Ana" },
        status: "PAID",
      },
      {
        id: "b",
        customerId: "customer-b",
        customer: { name: "Bruno" },
        status: "PAID",
      },
    ];
    const html = render("/finances?customerId=customer-b");
    expect(html).toContain("Bruno");
    expect(html).not.toContain("Ana");
  });
  it("does not offer payment for a paid charge", () => {
    state.focused.data.status = "PAID";
    expect(render("/finances?chargeId=old-charge&action=pay")).not.toContain(
      "Registrar pagamento"
    );
  });
});
