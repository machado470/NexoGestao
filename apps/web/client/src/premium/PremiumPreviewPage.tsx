/**
 * /premium-preview — NexoGestão Premium visual lab (PR 0).
 *
 * Development only: App.tsx registers this route behind import.meta.env.DEV,
 * so production builds do not ship this module. Everything shown uses the
 * fictional fixtures in demoData.ts under an explicit demo label.
 */
import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  FlaskConical,
  HeartPulse,
  History,
  Home,
  Inbox,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Moon,
  Package,
  Plus,
  ReceiptText,
  Search,
  Settings,
  Shield,
  Sun,
  TriangleAlert,
  User,
  Users,
  Wallet,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import "./premium.css";
import { premiumThemeStyle, premiumTokens, type PremiumTheme } from "./tokens";
import {
  NxAlert,
  NxBadge,
  NxButton,
  NxCard,
  NxField,
  NxKpiCard,
  NxLink,
  NxProgressList,
  NxState,
} from "./components";
import {
  chargeStatusLabel,
  demoAgenda,
  demoAttention,
  demoChargeBreakdown,
  demoCharges,
  demoCustomers,
  demoGovernance,
  demoKpis,
  demoNextAction,
  demoOrders,
  demoOrdersByStatus,
  demoRevenueByMonth,
  demoUser,
} from "./demoData";

type NavItem = { label: string; icon: typeof Home; anchor?: string };

/** Mirrors the real MainLayout groups and labels; only demonstrated modules link. */
const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Operação",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, anchor: "visao-geral" },
      { label: "Clientes", icon: Users, anchor: "clientes" },
      { label: "Agendamentos", icon: Calendar, anchor: "agenda" },
      { label: "Orçamentos", icon: ClipboardList },
      { label: "Catálogo de serviços", icon: BookOpen },
      { label: "Ordens de Serviço", icon: Briefcase, anchor: "ordens" },
    ],
  },
  {
    label: "Controle",
    items: [
      { label: "Financeiro", icon: DollarSign, anchor: "financas" },
      { label: "Estoque", icon: Package },
      { label: "Notas fiscais", icon: ReceiptText },
      { label: "Saúde financeira", icon: HeartPulse },
      { label: "WhatsApp", icon: MessageCircle },
      { label: "Timeline", icon: History },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { label: "Calendário", icon: CalendarDays },
      { label: "Governança", icon: Shield, anchor: "governanca" },
      { label: "Pessoas", icon: Building2 },
    ],
  },
  {
    label: "Sistema",
    items: [
      { label: "Planos", icon: CreditCard },
      { label: "Auditoria", icon: ClipboardList },
      { label: "Perfil", icon: User },
      { label: "Configurações", icon: Settings },
    ],
  },
];

const kpiIcon = { wallet: <Wallet />, clock: <Clock />, wrench: <Wrench />, alert: <TriangleAlert /> };

function initialTheme(): PremiumTheme {
  if (typeof window === "undefined") return "dark";
  return new URLSearchParams(window.location.search).get("theme") === "light" ? "light" : "dark";
}

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function Section({ id, title, subtitle, children, action }: { id: string; title: string; subtitle: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section id={id} className="nx-section" aria-labelledby={`${id}-title`}>
      <div className="nx-section-head">
        <div>
          <p className="nx-overline">Demonstração</p>
          <h2 id={`${id}-title`} className="nx-h1">
            {title}
          </h2>
          <p className="nx-text-2">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function PremiumPreviewPage() {
  const [theme, setTheme] = useState<PremiumTheme>(initialTheme);
  const [collapsed, setCollapsed] = useState(false);
  const [range, setRange] = useState<"6M" | "12M">("6M");
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const tokens = premiumTokens[theme];

  return (
    <div ref={setRoot} className="nx-root" data-nx-theme={theme} style={premiumThemeStyle(theme)}>
      <div className="nx-shell" data-collapsed={collapsed ? "true" : "false"}>
        <aside className="nx-sidebar" aria-label="Menu lateral (prévia)">
          <div className="nx-brand">
            <span className="nx-brand-mark" aria-hidden="true">
              <span style={{ background: "#ffffff" }} />
              <span style={{ background: "#f97316" }} />
              <span style={{ background: "#8b5cf6" }} />
              <span style={{ background: "#ffffff" }} />
            </span>
            <span className="nx-brand-name nx-hide-collapsed">
              NexoGestão<b>.</b>
            </span>
          </div>
          <nav className="nx-nav" aria-label="Navegação principal (prévia)">
            {navGroups.map(group => (
              <div key={group.label} className="nx-nav-group">
                <p className="nx-overline nx-hide-collapsed">{group.label}</p>
                {group.items.map(item => {
                  const Icon = item.icon;
                  const current = item.anchor === "visao-geral";
                  return item.anchor ? (
                    <a
                      key={item.label}
                      className="nx-nav-item"
                      href={`#${item.anchor}`}
                      aria-current={current ? "page" : undefined}
                      title={item.label}
                    >
                      <Icon aria-hidden="true" />
                      <span className="nx-hide-collapsed">{item.label}</span>
                    </a>
                  ) : (
                    <span key={item.label} className="nx-nav-item" aria-disabled="true" title={`${item.label} (fora desta prévia)`}>
                      <Icon aria-hidden="true" />
                      <span className="nx-hide-collapsed">{item.label}</span>
                    </span>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="nx-sidebar-foot">
            <button
              type="button"
              className="nx-nav-item nx-sidebar-toggle"
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(value => !value)}
            >
              {collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
              <span className="nx-hide-collapsed">Recolher menu</span>
            </button>
          </div>
        </aside>

        <div className="nx-main">
          <header className="nx-topbar">
            <label className="nx-search">
              <Search aria-hidden="true" width={18} height={18} />
              <span className="nx-sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                Buscar
              </span>
              <input type="search" placeholder="Buscar clientes, agendamentos, O.S." />
            </label>
            <span className="nx-topbar-spacer" />
            <div className="nx-theme-switch" role="group" aria-label="Tema da prévia">
              <button type="button" aria-label="Dark Premium" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>
                <Moon aria-hidden="true" />
                <span>Dark Premium</span>
              </button>
              <button type="button" aria-label="Light Premium" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>
                <Sun aria-hidden="true" />
                <span>Light Premium</span>
              </button>
            </div>
            <button type="button" className="nx-icon-btn" aria-label="Notificações: 3 não lidas (demonstração)">
              <Bell aria-hidden="true" />
              <span className="nx-dot">3</span>
            </button>
            <div className="nx-user">
              <span className="nx-avatar" aria-hidden="true">
                UD
              </span>
              <span className="nx-user-text">
                <strong>{demoUser.name}</strong>
                <span className="nx-caption">{demoUser.role}</span>
              </span>
            </div>
          </header>

          <main className="nx-content" id="conteudo-principal">
            <div className="nx-demo-banner" role="note">
              <FlaskConical aria-hidden="true" />
              <p>
                <strong>Laboratório visual NexoGestão Premium.</strong> Página disponível apenas em desenvolvimento. Todos os nomes e
                valores são <strong>dados de demonstração</strong> e não representam a operação real.
              </p>
            </div>

            <div className="nx-page-head">
              <div className="nx-page-title">
                <div>
                  <h1 className="nx-h1" style={{ fontSize: 28 }}>
                    Bem-vindo de volta
                  </h1>
                  <p className="nx-text-2">Resumo da operação de hoje · dados de demonstração</p>
                </div>
              </div>
              <span className="nx-chip">
                <CalendarDays aria-hidden="true" />
                Ter, 24 de nov de 2026
              </span>
            </div>

            <Section id="visao-geral" title="Visão geral" subtitle="Dashboard: indicadores, próxima ação, atenção imediata e receita mensal.">
              <div className="nx-grid">
                {demoKpis.map(kpi => (
                  <div key={kpi.id} className="nx-span-3">
                    <NxKpiCard label={kpi.label} value={kpi.value} icon={kpiIcon[kpi.icon]} delta={kpi.delta} action={kpi.action} />
                  </div>
                ))}

                <div className="nx-span-8">
                  <NxCard
                    title="Receita recebida por mês"
                    icon={<BarChart3 aria-hidden="true" />}
                    action={
                      <div className="nx-segmented" role="group" aria-label="Período">
                        {(["6M", "12M"] as const).map(option => (
                          <button key={option} type="button" aria-pressed={range === option} onClick={() => setRange(option)}>
                            {option}
                          </button>
                        ))}
                      </div>
                    }
                  >
                    <div className="nx-chart-total">
                      <span className="nx-display nx-num">R$ 48.750,00</span>
                      <span className="nx-delta" data-direction="up">
                        +18% vs. mês anterior
                      </span>
                    </div>
                    <div className="nx-chart" role="img" aria-label="Gráfico de área: receita recebida de junho a novembro (demonstração), subindo de R$ 31.200 para R$ 48.750.">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={demoRevenueByMonth} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="nx-area" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={tokens["--nx-chart-1"]} stopOpacity={0.35} />
                              <stop offset="100%" stopColor={tokens["--nx-chart-1"]} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke={tokens["--nx-line"]} vertical={false} />
                          <XAxis dataKey="month" stroke={tokens["--nx-muted"]} tickLine={false} axisLine={false} />
                          <YAxis
                            stroke={tokens["--nx-muted"]}
                            tickLine={false}
                            axisLine={false}
                            width={64}
                            tickFormatter={value => `${Math.round(Number(value) / 1000)} mil`}
                          />
                          <Tooltip
                            formatter={value => [currency(Number(value)), "Recebido"]}
                            contentStyle={{
                              background: tokens["--nx-raised"],
                              border: `1px solid ${tokens["--nx-line"]}`,
                              borderRadius: 10,
                              color: tokens["--nx-text"],
                            }}
                            labelStyle={{ color: tokens["--nx-text-2"] }}
                          />
                          <Area
                            type="monotone"
                            dataKey="received"
                            stroke={tokens["--nx-chart-1"]}
                            strokeWidth={2.5}
                            fill="url(#nx-area)"
                            dot={{ r: 3, fill: tokens["--nx-chart-1"], strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="nx-caption">Fonte proposta: recebimentos por mês (série mensal). Visão diária depende de novo endpoint.</p>
                  </NxCard>
                </div>

                <div className="nx-span-4" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <NxCard
                    className="nx-action-card"
                    title="Próxima melhor ação"
                    icon={<Zap aria-hidden="true" />}
                    action={<NxBadge tone="brand">{demoNextAction.priority}</NxBadge>}
                  >
                    <h4 className="nx-h2">{demoNextAction.title}</h4>
                    <p className="nx-caption">{demoNextAction.entity} · {demoNextAction.when}</p>
                    <div className="nx-kv">
                      <p className="nx-wrap-anywhere">
                        <strong>Problema</strong>
                        {demoNextAction.reason}
                      </p>
                      <p>
                        <strong>Consequência</strong>
                        {demoNextAction.impact}
                      </p>
                    </div>
                    <NxButton variant="primary" block>
                      <MessageCircle aria-hidden="true" />
                      {demoNextAction.cta}
                    </NxButton>
                  </NxCard>

                  <NxCard title="Atenção imediata" icon={<TriangleAlert aria-hidden="true" />} action={<NxLink>Ver todas</NxLink>}>
                    <ul className="nx-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {demoAttention.map(item => (
                        <li key={item.id} className="nx-list-item">
                          <span className="nx-list-icon" data-tone={item.severity} aria-hidden="true">
                            <AlertCircle />
                          </span>
                          <div>
                            <NxBadge tone={item.severity}>{item.label}</NxBadge>
                            <strong>{item.title}</strong>
                            <span className="nx-caption">{item.reason}</span>
                          </div>
                          <span />
                        </li>
                      ))}
                    </ul>
                  </NxCard>
                </div>
              </div>
            </Section>

            <Section
              id="financas"
              title="Financeiro"
              subtitle="Carteira com filtros, tabela, paginação e composição por status."
              action={<NewChargeDialog container={root} />}
            >
              <div className="nx-grid">
                <div className="nx-span-8">
                  <NxCard title="Carteira de cobranças" icon={<DollarSign aria-hidden="true" />}>
                    <div className="nx-filters">
                      <label className="nx-search">
                        <Search aria-hidden="true" width={18} height={18} />
                        <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Buscar cobranças</span>
                        <input type="search" placeholder="Buscar por cliente ou valor" />
                      </label>
                      <select className="nx-select" style={{ width: 180 }} aria-label="Filtrar por status" defaultValue="all">
                        <option value="all">Todos os status</option>
                        <option>Pendentes</option>
                        <option>Vencidas</option>
                        <option>Pagas</option>
                      </select>
                      <div className="nx-segmented" role="group" aria-label="Vencimento">
                        <button type="button" aria-pressed="true">Este mês</button>
                        <button type="button" aria-pressed="false">Próximo</button>
                      </div>
                    </div>
                    <div className="nx-table-wrap">
                      <table className="nx-table">
                        <thead>
                          <tr>
                            <th scope="col">Cliente</th>
                            <th scope="col">Vencimento</th>
                            <th scope="col" className="nx-right">Valor</th>
                            <th scope="col">Status</th>
                            <th scope="col" className="nx-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {demoCharges.map(charge => (
                            <tr key={charge.id}>
                              <td data-cell="customer">{charge.customer}</td>
                              <td className="nx-num nx-text-2">{charge.due}</td>
                              <td className="nx-num nx-right">
                                <strong>{charge.amount}</strong>
                              </td>
                              <td>
                                <NxBadge tone={charge.status === "PAID" ? "ok" : charge.status === "OVERDUE" ? "bad" : "info"}>
                                  {chargeStatusLabel[charge.status]}
                                </NxBadge>
                              </td>
                              <td className="nx-right" data-cell="action">
                                {charge.status === "PAID" ? (
                                  <NxButton size="sm" variant="ghost">Ver recibo</NxButton>
                                ) : (
                                  <NxButton size="sm" variant="secondary">Registrar pagamento</NxButton>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="nx-pagination">
                      <span className="nx-caption">Mostrando 1–5 de 23 cobranças (demonstração)</span>
                      <nav aria-label="Paginação">
                        <NxButton size="sm" variant="secondary" disabled>Anterior</NxButton>
                        <NxButton size="sm" variant="secondary">Próxima</NxButton>
                      </nav>
                    </div>
                  </NxCard>
                </div>
                <div className="nx-span-4">
                  <NxCard title="Cobranças por status" icon={<Wallet aria-hidden="true" />}>
                    <NxProgressList items={demoChargeBreakdown} />
                    <div className="nx-divider" />
                    <NxAlert tone="warn" title="2 cobranças vencidas sem contato">
                      Registrar o contato evita que a pendência vire inadimplência.
                    </NxAlert>
                  </NxCard>
                </div>
              </div>
            </Section>

            <Section id="clientes" title="Clientes" subtitle="Cartões com estado operacional, saldo e próxima ação.">
              <div className="nx-grid">
                {demoCustomers.map(customer => (
                  <div key={customer.id} className="nx-span-4">
                    <NxCard className="nx-customer">
                      <div className="nx-customer-head">
                        <div>
                          <h3 className="nx-h2">{customer.name}</h3>
                          <span className="nx-caption nx-wrap-anywhere">{customer.contact}</span>
                        </div>
                        <NxBadge tone={customer.state.tone}>{customer.state.label}</NxBadge>
                      </div>
                      <div className="nx-divider" />
                      <p className="nx-num">
                        <strong>{customer.balance}</strong>
                      </p>
                      <p className="nx-text-2">Próxima ação: {customer.next}</p>
                      <NxButton variant="secondary" block>Abrir cliente</NxButton>
                    </NxCard>
                  </div>
                ))}
              </div>
            </Section>

            <div className="nx-grid">
              <div className="nx-span-6">
                <Section id="agenda" title="Agenda" subtitle="Agendamentos do dia com responsável e status.">
                  <NxCard title="Hoje" icon={<Calendar aria-hidden="true" />} action={<NxLink>Abrir calendário</NxLink>}>
                    <ul className="nx-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {demoAgenda.map(slot => (
                        <li key={slot.id} className="nx-list-item">
                          <span className="nx-time nx-num">{slot.time}</span>
                          <div>
                            <strong>{slot.customer}</strong>
                            <span className="nx-text-2">{slot.service}</span>
                            <span className="nx-caption">Responsável: {slot.person}</span>
                          </div>
                          <NxBadge tone={slot.status.tone}>{slot.status.label}</NxBadge>
                        </li>
                      ))}
                    </ul>
                  </NxCard>
                </Section>
              </div>
              <div className="nx-span-6">
                <Section id="ordens" title="Ordens de Serviço" subtitle="Distribuição por status e fila com ação principal.">
                  <NxCard title="Status das O.S." icon={<Briefcase aria-hidden="true" />} action={<NxLink>Ver todas</NxLink>}>
                    <NxProgressList items={demoOrdersByStatus.map(item => ({ ...item, detail: `${item.count}` }))} />
                    <div className="nx-divider" />
                    <ul className="nx-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {demoOrders.map(order => (
                        <li key={order.id} className="nx-list-item">
                          <span className="nx-list-icon" data-tone={order.status.tone} aria-hidden="true">
                            <Wrench />
                          </span>
                          <div>
                            <span className="nx-caption nx-num">{order.code} · {order.customer}</span>
                            <strong>{order.title}</strong>
                            <span className="nx-caption">Prazo: {order.due}</span>
                          </div>
                          <NxButton size="sm" variant={order.action === "Concluir" ? "primary" : "secondary"}>
                            {order.action}
                          </NxButton>
                        </li>
                      ))}
                    </ul>
                  </NxCard>
                </Section>
              </div>
            </div>

            <Section id="governanca" title="Governança" subtitle="Situação oficial, referência da avaliação e sinais.">
              <div className="nx-grid">
                <div className="nx-span-5">
                  <NxCard title="Situação atual" icon={<Shield aria-hidden="true" />}>
                    <NxBadge tone={demoGovernance.state.tone}>{demoGovernance.state.label}</NxBadge>
                    <h3 className="nx-h2">{demoGovernance.title}</h3>
                    <p className="nx-caption">{demoGovernance.reference}</p>
                    <NxButton variant="secondary">Atualizar fontes</NxButton>
                  </NxCard>
                </div>
                <div className="nx-span-7">
                  <NxCard title="Sinais oficiais" icon={<AlertCircle aria-hidden="true" />}>
                    <ul className="nx-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {demoGovernance.signals.map(signal => (
                        <li key={signal.id} className="nx-list-item">
                          <span className="nx-list-icon" data-tone={signal.tone} aria-hidden="true">
                            <TriangleAlert />
                          </span>
                          <div>
                            <strong>{signal.label}</strong>
                          </div>
                          <strong className="nx-num" style={{ fontSize: 18 }}>
                            {signal.value}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  </NxCard>
                </div>
              </div>
            </Section>

            <Section id="componentes" title="Componentes compartilhados" subtitle="Formulário, botões, selos, alertas e estados de interface.">
              <div className="nx-grid">
                <div className="nx-span-7">
                  <NxCard title="Formulário" icon={<ClipboardList aria-hidden="true" />}>
                    <div className="nx-form-grid">
                      <NxField id="nx-f-customer" label="Cliente">
                        <select id="nx-f-customer" className="nx-select" defaultValue="">
                          <option value="" disabled>
                            Selecione um cliente
                          </option>
                          {demoCustomers.map(customer => (
                            <option key={customer.id}>{customer.name}</option>
                          ))}
                        </select>
                      </NxField>
                      <NxField id="nx-f-due" label="Vencimento" hint="Data em que a cobrança vence.">
                        <input id="nx-f-due" className="nx-input" type="date" defaultValue="2026-11-30" aria-describedby="nx-f-due-hint" />
                      </NxField>
                      <NxField id="nx-f-amount" label="Valor" error="Informe um valor maior que zero.">
                        <input id="nx-f-amount" className="nx-input" inputMode="decimal" defaultValue="0,00" aria-invalid="true" aria-describedby="nx-f-amount-error" />
                      </NxField>
                      <NxField id="nx-f-method" label="Forma de pagamento">
                        <select id="nx-f-method" className="nx-select" defaultValue="PIX">
                          <option>PIX</option>
                          <option>Cartão</option>
                          <option>Transferência</option>
                          <option>Dinheiro</option>
                        </select>
                      </NxField>
                      <NxField id="nx-f-notes" label="Observações" full>
                        <textarea id="nx-f-notes" className="nx-textarea" placeholder="Informações para a equipe financeira" />
                      </NxField>
                      <label className="nx-check nx-full">
                        <input type="checkbox" defaultChecked />
                        Enviar lembrete ao cliente no vencimento
                      </label>
                    </div>
                    <div className="nx-form-actions">
                      <NxButton variant="ghost">Cancelar</NxButton>
                      <NxButton variant="primary">Salvar cobrança</NxButton>
                    </div>
                  </NxCard>
                </div>
                <div className="nx-span-5" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <NxCard title="Botões e selos">
                    <div className="nx-filters">
                      <NxButton variant="primary">
                        <Plus aria-hidden="true" />
                        Ação principal
                      </NxButton>
                      <NxButton variant="secondary">Secundária</NxButton>
                      <NxButton variant="ghost">Discreta</NxButton>
                      <NxButton variant="danger">Cancelar cobrança</NxButton>
                      <NxButton variant="primary" disabled>
                        Indisponível
                      </NxButton>
                    </div>
                    <div className="nx-filters">
                      <NxBadge tone="ok">Paga</NxBadge>
                      <NxBadge tone="info">Agendado</NxBadge>
                      <NxBadge tone="warn">Atenção</NxBadge>
                      <NxBadge tone="bad">Vencida</NxBadge>
                      <NxBadge tone="brand">Alta prioridade</NxBadge>
                      <NxBadge tone="neutral">Rascunho</NxBadge>
                    </div>
                  </NxCard>
                  <NxCard title="Alertas e notificações">
                    <NxAlert tone="ok" title="Pagamento registrado">R$ 1.850,00 de Condomínio Parque das Flores.</NxAlert>
                    <NxAlert tone="info" title="Sincronização em andamento">Os dados são atualizados a cada 5 minutos.</NxAlert>
                    <NxAlert tone="bad" title="Não foi possível salvar">Verifique o valor informado e tente novamente.</NxAlert>
                    <div className="nx-toast" role="status">
                      <CheckCircle2 aria-hidden="true" />
                      <span>Lembrete enviado para Clínica Vida Leve.</span>
                    </div>
                  </NxCard>
                </div>
                <div className="nx-span-4">
                  <NxState
                    icon={<Inbox />}
                    title="Nenhum orçamento ainda"
                    description="Cadastre serviços no catálogo e crie a primeira proposta para um cliente."
                    action={<NxButton variant="primary">Novo orçamento</NxButton>}
                  />
                </div>
                <div className="nx-span-4">
                  <div className="nx-state" role="status" aria-busy="true" aria-label="Carregando (exemplo)">
                    <span className="nx-skeleton" style={{ width: "70%", height: 18 }} />
                    <span className="nx-skeleton" style={{ width: "90%", height: 12 }} />
                    <span className="nx-skeleton" style={{ width: "55%", height: 12 }} />
                    <span className="nx-skeleton" style={{ width: 140, height: 36 }} />
                  </div>
                </div>
                <div className="nx-span-4">
                  <NxState
                    icon={<AlertCircle />}
                    tone="bad"
                    title="Não foi possível carregar"
                    description="A carteira financeira está indisponível no momento. Sua sessão continua válida."
                    action={<NxButton variant="secondary">Tentar novamente</NxButton>}
                  />
                </div>
              </div>
            </Section>
          </main>
        </div>
      </div>

      <nav className="nx-bottom-nav" aria-label="Navegação principal no celular (prévia)">
        <a href="#visao-geral" aria-current="page">
          <Home aria-hidden="true" />
          Início
        </a>
        <a href="#agenda">
          <Calendar aria-hidden="true" />
          Agenda
        </a>
        <a href="#clientes">
          <Users aria-hidden="true" />
          Clientes
        </a>
        <a href="#financas">
          <DollarSign aria-hidden="true" />
          Financeiro
        </a>
        <a href="#componentes">
          <Menu aria-hidden="true" />
          Mais
        </a>
      </nav>
    </div>
  );
}

function NewChargeDialog({ container }: { container: HTMLElement | null }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <NxButton variant="primary">
          <Plus aria-hidden="true" />
          Nova cobrança
        </NxButton>
      </Dialog.Trigger>
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Overlay className="nx-overlay" />
        <Dialog.Content className="nx-modal">
          <div className="nx-modal-head">
            <div>
              <Dialog.Title className="nx-h1" style={{ fontSize: 20 }}>
                Nova cobrança
              </Dialog.Title>
              <Dialog.Description className="nx-text-2">Exemplo de modal: nada é enviado.</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="nx-icon-btn" aria-label="Fechar">
                <X aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <div className="nx-form-grid">
            <NxField id="nx-m-customer" label="Cliente" full>
              <select id="nx-m-customer" className="nx-select" defaultValue={demoCustomers[0].name}>
                {demoCustomers.map(customer => (
                  <option key={customer.id}>{customer.name}</option>
                ))}
              </select>
            </NxField>
            <NxField id="nx-m-amount" label="Valor">
              <input id="nx-m-amount" className="nx-input" inputMode="decimal" defaultValue="1.240,00" />
            </NxField>
            <NxField id="nx-m-due" label="Vencimento">
              <input id="nx-m-due" className="nx-input" type="date" defaultValue="2026-11-30" />
            </NxField>
          </div>
          <div className="nx-form-actions">
            <Dialog.Close asChild>
              <NxButton variant="ghost">Cancelar</NxButton>
            </Dialog.Close>
            <Dialog.Close asChild>
              <NxButton variant="primary">Criar cobrança</NxButton>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
