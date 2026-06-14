import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("client/src/pages/CustomersPage.tsx", "utf8");
const commandLayerSource = readFileSync("client/src/components/app/OperationalCommandLayer.tsx", "utf8");
const embeddedTimelineSource = source.slice(
  source.indexOf("<NexoEvidenceTimeline")
);

describe("CustomersPage operational client center", () => {
  it("positions Clientes as the customer operational center", () => {
    expect(source).toContain("Centro Operacional do Cliente");
    expect(source).toContain("Hero Executivo do Cliente");
    expect(source).toContain("Sinal principal:");
    expect(source).toContain("Decisão do sistema");
    expect(source).toContain("Painel operacional do cliente");
    expect(source).toContain("Mini-cards de financeiro, execução, agenda, comunicação e governança.");
  });

  it("keeps the client pipeline focused on operational flow instead of raw cadastro", () => {
    ["Cliente", "Agendamento", "O.S.", "Cobrança", "Pagamento"].forEach(stage =>
      expect(source).toContain(`label: "${stage}"`)
    );
    expect(source).toContain(
      "Cliente → Agendamento → O.S. → Cobrança → Pagamento"
    );
    expect(source).toContain("Editar cadastro");
    expect(source).not.toContain('id: "timeline"');
    expect(source).not.toContain('id: "risk"');
    expect(source).not.toContain(
      'selectedProfile?.contact ?? "Cadastro carregado."'
    );
  });

  it("humanizes the embedded customer timeline and does not render raw technical identifiers", () => {
    expect(source).toContain("Mensagem enviada");
    expect(source).toContain("Contato operacional registrado com o cliente.");
    expect(source).toContain("Agendamento criado");
    expect(source).toContain("O.S. concluída");
    expect(source).toContain("Pagamento registrado no histórico do cliente.");
    expect(commandLayerSource).toContain("getEvidenceTimelineIcon");
    expect(embeddedTimelineSource).not.toContain("MESSAGE_SENT");
    expect(embeddedTimelineSource).not.toContain("WHATSAPP_MESSAGE_SENT");
    expect(embeddedTimelineSource).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
    );
    expect(embeddedTimelineSource).not.toContain("eventType");
    expect(embeddedTimelineSource).not.toContain("entityId");
  });

  it("keeps WhatsApp inline condensed and exposes real primary CTAs", () => {
    expect(source).not.toContain("<textarea");
    ["Abrir WhatsApp", "Agendar", "Cobrar", "Ver timeline"].forEach(cta =>
      expect(source).toContain(cta)
    );
    expect(source).toContain("openCustomerWhatsApp");
  });

  it("keeps the operational wallet command-centered with real CTAs", () => {
    expect(source).toContain("Carteira operacional");
    expect(source).toContain("Contexto / status");
    expect(source).toContain("Próxima ação");
    expect(source).toContain("Financeiro");
    expect(source).toContain("Mais ações");
    expect(source).toContain("AppPagination");
  });
});
