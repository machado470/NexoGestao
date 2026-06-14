import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("client/src/pages/AppointmentsPage.tsx", "utf8");
const selectedExperience = source.slice(source.indexOf("{selected ? ("));
const flowSource = source.slice(
  source.indexOf("const appointmentFlowStages"),
  source.indexOf("const appointmentTimelineEvents")
);
const embeddedTimelineSource = source.slice(
  source.indexOf("const appointmentTimelineEvents"),
  source.indexOf("function goToWhatsAppAppointment")
);

describe("AppointmentsPage as operational execution entry", () => {
  it("exposes the appointment executive hero and real operational CTAs", () => {
    expect(source).toContain("Hero executivo do agendamento");
    [
      "Abrir cliente",
      "Abrir agendamento",
      "Remarcar/editar",
      "Abrir O.S.",
      "Criar O.S.",
      "WhatsApp",
      "Ver financeiro",
      "Ver timeline",
    ].forEach(cta => expect(source).toContain(cta));
    expect(source).toContain("Sinal principal");
    expect(source).toContain("Próxima ação:");
  });

  it("uses one decision and next action block with human operational language", () => {
    expect(source).toContain("Decisão e próxima ação");
    expect(source).toContain("Estado operacional");
    expect(source).toContain("Maior risco agora");
    expect(source).toContain("Motivo:");
    expect(source).toContain("Impacto:");
    expect(source).toContain("Nota de segurança:");
    expect(source).not.toContain('title="Decisão do sistema"');
    expect(source).not.toContain("<NexoPriorityPanel");
  });

  it("keeps the main pipeline limited to Cliente → Agendamento → O.S. → Cobrança → Pagamento", () => {
    ["Cliente", "Agendamento", "O.S.", "Cobrança", "Pagamento"].forEach(stage =>
      expect(flowSource).toContain(`label: "${stage}"`)
    );
    expect(source).toContain("Cliente → Agendamento → O.S. → Cobrança → Pagamento");
    expect(flowSource).not.toContain('label: "Timeline"');
    expect(flowSource).not.toContain('label: "Risco"');
    expect(flowSource).not.toContain('id: "timeline"');
    expect(flowSource).not.toContain('id: "risk"');
    expect(flowSource).toContain("Vinculada");
    expect(flowSource).toContain("Sem cobrança vinculada");
  });

  it("orders selected detail before supporting operational list", () => {
    expect(selectedExperience.indexOf("Hero executivo do agendamento")).toBeLessThan(
      selectedExperience.indexOf("Outros agendamentos da operação")
    );
    expect(selectedExperience.indexOf("Decisão e próxima ação")).toBeLessThan(
      selectedExperience.indexOf("Outros agendamentos da operação")
    );
    expect(selectedExperience.indexOf("Fluxo de entrada do agendamento")).toBeLessThan(
      selectedExperience.indexOf("Outros agendamentos da operação")
    );
  });

  it("humanizes embedded timeline events and hides raw technical fields", () => {
    [
      "Agendamento criado",
      "Agendamento confirmado",
      "Agendamento alterado",
      "Agendamento cancelado",
      "O.S. criada",
      "Mensagem enviada",
      "Cobrança criada",
      "Evento operacional registrado",
    ].forEach(text => expect(source).toContain(text));
    expect(embeddedTimelineSource).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
    );
    expect(embeddedTimelineSource).not.toContain("metadata");
    expect(embeddedTimelineSource).not.toContain("entityId");
    expect(embeddedTimelineSource).not.toContain("eventType cru");
  });

  it("keeps operational summary, honest incidents, empty filter copy and no fake automation", () => {
    ["Hoje", "Confirmados", "Não confirmados", "Atrasados", "Concluídos"].forEach(metric =>
      expect(source).toContain(metric)
    );
    expect(source).toContain("Atenção imediata");
    expect(source).toContain("Fonte atual não entrega resposta do cliente nesta tela");
    expect(source).toContain("Nenhum agendamento para o filtro atual");
    expect(source).toContain("não cria fluxo novo de comunicação");
    expect(source).not.toContain("automação automática");
    expect(source).not.toContain("disparo automático");
  });
});
