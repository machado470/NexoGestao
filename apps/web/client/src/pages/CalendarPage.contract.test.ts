import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = () => readFileSync("client/src/pages/CalendarPage.tsx", "utf8");
const compact = (value: string) => value.replace(/\s+/g, " ").trim();

describe("CalendarPage operational time-control contract", () => {
  it("posiciona calendário como centro de controle do tempo, não Google Calendar genérico", () => {
    const calendar = source();

    expect(calendar).toContain("Centro de controle do tempo da operação");
    expect(calendar).toContain("Visão estratégica do tempo");
    expect(calendar).toContain("distribuição, conflitos, vazios e sobrecarga");
    expect(calendar).not.toContain("Google Calendar");
  });

  it("mostra KPIs de tempo, pipeline operacional e leitura macro diferente de Agendamentos", () => {
    const calendar = source();
    const normalized = compact(calendar);

    expect(calendar).toContain("Conflitos agora");
    expect(calendar).toContain("Sobrecarga");
    expect(calendar).toContain("Janela livre");
    expect(calendar).toContain("Capacidade da equipe");
    expect(normalized).toContain(
      "Tempo → Agendamento → Responsável → O.S. → Execução → Timeline → Risco/Governança"
    );
    expect(compact(calendar)).toContain(
      "Calendário orienta; Agendamentos executa criação, confirmação e remarcação."
    );
  });

  it("mantém grade visual/fallback, painel lateral vivo e CTAs seguros", () => {
    const calendar = source();

    expect(calendar).toContain("Calendário visual interativo");
    expect(calendar).toContain("Sem eventos para este recorte");
    expect(calendar).toContain("Painel lateral do evento");
    expect(compact(calendar)).toContain("Exibindo próximo evento crítico");
    expect(calendar).toContain("CTAs navegam para fluxos existentes");
    expect(calendar).toContain("não executa automação falsa");
  });

  it("não fabrica prova operacional nem expõe metadados técnicos na leitura principal", () => {
    const calendar = source();

    expect(calendar).toContain(
      "Fallback seguro: eventos derivados de agendamentos com datas reais; não substitui Timeline oficial."
    );
    expect(calendar).not.toContain("eventType");
    expect(calendar).not.toContain("payload");
    expect(calendar).not.toContain("metadata");
  });
});
