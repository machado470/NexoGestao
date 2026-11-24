/**
 * Demonstration fixtures for the Premium preview (PR 0).
 *
 * Every number and name here is fictional and is rendered under an explicit
 * "Dados de demonstração" label. Nothing is fetched or persisted. Only modules
 * that exist in NexoGestão appear here.
 */

export const demoUser = { name: "Usuário de demonstração", role: "Administrador" };

export const demoKpis = [
  {
    id: "received",
    label: "Recebido no mês",
    value: "R$ 48.750,00",
    delta: { direction: "up" as const, text: "+18% vs. mês anterior" },
    icon: "wallet" as const,
  },
  {
    id: "receivable",
    label: "A receber",
    value: "R$ 12.430,00",
    delta: { direction: "down" as const, text: "−6% vs. mês anterior" },
    icon: "clock" as const,
  },
  {
    id: "orders",
    label: "O.S. em aberto",
    value: "37",
    delta: { direction: "up" as const, text: "+4 vs. semana anterior" },
    icon: "wrench" as const,
  },
  {
    id: "attention",
    label: "Atenção imediata",
    value: "5",
    delta: null,
    action: "Ver pendências",
    icon: "alert" as const,
  },
];

/** Monthly series only: daily series do not exist in the product yet. */
export const demoRevenueByMonth = [
  { month: "Jun", received: 31200 },
  { month: "Jul", received: 34800 },
  { month: "Ago", received: 33100 },
  { month: "Set", received: 39900 },
  { month: "Out", received: 41300 },
  { month: "Nov", received: 48750 },
];

export const demoNextAction = {
  priority: "Alta prioridade",
  title: "Entrar em contato com cliente com pagamento vencido há 7 dias",
  entity: "Cobrança · Clínica Vida Leve",
  reason: "CHARGE_OVERDUE_WITHOUT_CONTACT",
  impact: "Recebimento atrasado e risco de inadimplência.",
  cta: "Abrir conversa no WhatsApp com o cliente",
  when: "Hoje · 16:00",
};

export const demoAttention = [
  {
    id: "a1",
    severity: "bad" as const,
    label: "Crítico",
    title: "Cobrança vencida sem contato",
    reason: "Vencida há 7 dias e sem lembrete enviado.",
    cta: "Registrar contato de cobrança",
  },
  {
    id: "a2",
    severity: "warn" as const,
    label: "Atenção",
    title: "O.S. concluída sem cobrança",
    reason: "Serviço finalizado há 2 dias aguardando faturamento.",
    cta: "Gerar cobrança da O.S.",
  },
];

export type DemoChargeStatus = "PAID" | "PENDING" | "OVERDUE";

export const demoCharges: Array<{
  id: string;
  customer: string;
  due: string;
  amount: string;
  status: DemoChargeStatus;
}> = [
  { id: "c1", customer: "Clínica Vida Leve", due: "18/11/2026", amount: "R$ 1.240,00", status: "OVERDUE" },
  { id: "c2", customer: "Loja Center Tech", due: "25/11/2026", amount: "R$ 2.120,00", status: "PENDING" },
  { id: "c3", customer: "Condomínio Parque das Flores", due: "12/11/2026", amount: "R$ 1.850,00", status: "PAID" },
  { id: "c4", customer: "Escola Crescer Mais", due: "28/11/2026", amount: "R$ 1.430,00", status: "PENDING" },
  { id: "c5", customer: "João Silva", due: "20/11/2026", amount: "R$ 480,00", status: "OVERDUE" },
];

export const chargeStatusLabel: Record<DemoChargeStatus, string> = {
  PAID: "Paga",
  PENDING: "Pendente",
  OVERDUE: "Vencida",
};

export const demoChargeBreakdown = [
  { id: "paid", label: "Pagas", percent: 58, tone: "ok" as const },
  { id: "pending", label: "Pendentes", percent: 30, tone: "info" as const },
  { id: "overdue", label: "Vencidas", percent: 12, tone: "bad" as const },
];

export const demoCustomers = [
  {
    id: "k1",
    name: "Clínica Vida Leve",
    contact: "(11) 98888-1020 · contato@vidaleve.exemplo",
    state: { label: "Risco", tone: "bad" as const },
    balance: "R$ 1.240,00 em aberto",
    next: "Registrar contato de cobrança",
  },
  {
    id: "k2",
    name: "Loja Center Tech",
    contact: "(11) 97777-3344 · compras@centertech.exemplo",
    state: { label: "Atenção", tone: "warn" as const },
    balance: "R$ 2.120,00 a vencer",
    next: "Confirmar agendamento de amanhã",
  },
  {
    id: "k3",
    name: "Condomínio Parque das Flores",
    contact: "(11) 96666-5566 · sindico@parque.exemplo",
    state: { label: "Normal", tone: "ok" as const },
    balance: "Sem pendências",
    next: "Sem ação recomendada",
  },
];

export const demoAgenda = [
  { id: "g1", time: "08:30", customer: "Escola Crescer Mais", service: "Manutenção preventiva do ar-condicionado", person: "Rafael Operações", status: { label: "Confirmado", tone: "ok" as const } },
  { id: "g2", time: "10:00", customer: "Loja Center Tech", service: "Instalação de rede", person: "Paula Almeida", status: { label: "Agendado", tone: "info" as const } },
  { id: "g3", time: "14:00", customer: "Clínica Vida Leve", service: "Vistoria técnica", person: "Sem responsável", status: { label: "Sem responsável", tone: "warn" as const } },
];

export const demoOrdersByStatus = [
  { id: "open", label: "Abertas", count: 12, percent: 32, tone: "info" as const },
  { id: "progress", label: "Em andamento", count: 16, percent: 43, tone: "brand" as const },
  { id: "done", label: "Concluídas no mês", count: 9, percent: 25, tone: "ok" as const },
];

export const demoOrders = [
  { id: "o1", code: "OS-2026-1047", customer: "Escola Crescer Mais", title: "Reparo emergencial no reservatório", due: "Hoje, 17:00", status: { label: "Em andamento", tone: "brand" as const }, action: "Concluir" },
  { id: "o2", code: "OS-2026-1043", customer: "Condomínio Parque das Flores", title: "Implementação de sistema de acesso", due: "29/11/2026", status: { label: "Concluída", tone: "ok" as const }, action: "Gerar cobrança" },
  { id: "o3", code: "OS-2026-1039", customer: "Loja Center Tech", title: "Reestruturação da rede da loja", due: "Atrasada 1 dia", status: { label: "Atrasada", tone: "bad" as const }, action: "Abrir detalhe" },
];

export const demoGovernance = {
  state: { label: "Operação em atenção", tone: "warn" as const },
  title: "Avaliação concluída com 3 sinais oficiais",
  reference: "Referência: 24/11/2026, 09:12",
  signals: [
    { id: "s1", label: "Cobranças vencidas sem contato", value: "2", tone: "bad" as const },
    { id: "s2", label: "O.S. concluídas sem cobrança", value: "1", tone: "warn" as const },
    { id: "s3", label: "Agendamentos sem responsável", value: "1", tone: "warn" as const },
  ],
};
