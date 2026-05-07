import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  WhatsAppActionExecutionPanel,
  WhatsAppExecutionHistoryItem,
  compactWhatsAppPayloadSummary,
  type WhatsAppActionExecution,
} from "./whatsappActionExecution";

const pendingExecution: WhatsAppActionExecution = {
  id: "exec_pending",
  conversationId: "conv_1",
  suggestedAction: "SEND_PAYMENT_LINK",
  status: "PENDING_APPROVAL",
  approvalRequired: true,
  executionReason: "Enviar link com revisão humana",
  actionPayload: {
    customerName: "Ana",
    paymentLink: "https://pay.local/1",
    chargeAmount: 12500,
  },
  createdAt: "2026-05-06T10:00:00.000Z",
  conversation: { title: "Ana · cobrança", priority: "CRITICAL" },
};

const executedExecution: WhatsAppActionExecution = {
  id: "exec_done",
  conversationId: "conv_1",
  suggestedAction: "CONFIRM_APPOINTMENT",
  status: "EXECUTED",
  executionReason: "Confirmar agenda",
  actionPayload: { customerName: "Ana", appointmentDate: "2026-05-07T10:00:00.000Z" },
  executedAt: "2026-05-06T10:03:00.000Z",
};

describe("WhatsApp action execution UI", () => {
  it("renders pending approvals with compact payload and safe execution state", () => {
    const html = renderToStaticMarkup(
      <WhatsAppActionExecutionPanel
        pendingApprovals={[pendingExecution]}
        history={[]}
        isLoading={false}
        onApprove={vi.fn()}
        onExecute={vi.fn()}
        onCancel={vi.fn()}
        isMutating={false}
      />
    );

    expect(html).toContain("Aguardando aprovação");
    expect(html).toContain("Enviar link de pagamento");
    expect(html).toContain("Cliente: Ana");
    expect(html).toContain("Aprove antes de executar");
  });

  it("renders empty states for approvals and history", () => {
    const html = renderToStaticMarkup(
      <WhatsAppActionExecutionPanel
        pendingApprovals={[]}
        history={[]}
        isLoading={false}
        onApprove={vi.fn()}
        onExecute={vi.fn()}
        onCancel={vi.fn()}
        isMutating={false}
      />
    );

    expect(html).toContain("Nenhuma aprovação pendente");
    expect(html).toContain("Nenhuma execução recente registrada");
  });

  it("disables approve execute and cancel buttons while a mutation is pending", () => {
    const html = renderToStaticMarkup(
      <WhatsAppActionExecutionPanel
        pendingApprovals={[pendingExecution]}
        history={[]}
        isLoading={false}
        onApprove={vi.fn()}
        onExecute={vi.fn()}
        onCancel={vi.fn()}
        isMutating={true}
      />
    );

    expect((html.match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(html).toContain("Processando");
  });

  it("renders execution history with consistent status badge", () => {
    const html = renderToStaticMarkup(<WhatsAppExecutionHistoryItem execution={executedExecution} />);

    expect(html).toContain("Confirmar agendamento");
    expect(html).toContain("Executada");
    expect(html).toContain("Cliente: Ana");
  });

  it("summarizes action payload compactly", () => {
    expect(compactWhatsAppPayloadSummary(pendingExecution.actionPayload)).toBe(
      "Cliente: Ana · Link: https://pay.local/1 · Valor: 12500"
    );
  });
});
