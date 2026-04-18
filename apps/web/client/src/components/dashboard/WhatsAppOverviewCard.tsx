import { AppSectionBlock, AppStatusBadge } from "@/components/internal-page-system";

type InteractionStatus = "enviado" | "entregue" | "falha";

type WhatsAppInteractionItem = {
  id: string;
  customerName: string;
  action: string;
  status: InteractionStatus;
};

type WhatsAppOverviewData = {
  sentToday: number;
  pending: number;
  failed: number;
  interactions: WhatsAppInteractionItem[];
  insight?: string;
};

type WhatsAppOverviewCardProps = {
  className?: string;
  onOpenWhatsApp: () => void;
  data?: WhatsAppOverviewData;
};

const DEFAULT_WHATSAPP_OVERVIEW: WhatsAppOverviewData = {
  sentToday: 128,
  pending: 12,
  failed: 3,
  interactions: [
    {
      id: "wa-1",
      customerName: "Fernanda Souza",
      action: "Cobrança enviada",
      status: "entregue",
    },
    {
      id: "wa-2",
      customerName: "Lucas Martins",
      action: "Confirmação de visita",
      status: "enviado",
    },
    {
      id: "wa-3",
      customerName: "Clínica Vida Nova",
      action: "Confirmação de pagamento",
      status: "falha",
    },
  ],
  insight: "2 cobranças não visualizadas · 1 cliente sem resposta",
};

function getStatusBadgeLabel(status: InteractionStatus) {
  if (status === "entregue") return "Entregue";
  if (status === "falha") return "Falha";
  return "Enviado";
}

export function WhatsAppOverviewCard({
  className,
  onOpenWhatsApp,
  data = DEFAULT_WHATSAPP_OVERVIEW,
}: WhatsAppOverviewCardProps) {
  return (
    <AppSectionBlock
      title="WhatsApp Operacional"
      subtitle="Resumo das interações com clientes"
      className={className}
      ctaLabel="Abrir WhatsApp"
      onCtaClick={onOpenWhatsApp}
    >
      <div className="flex h-full flex-col gap-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
            <p className="text-xs font-medium text-[var(--text-secondary)]">Enviadas hoje</p>
            <p className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              {data.sentToday}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
            <p className="text-xs font-medium text-[var(--text-secondary)]">Pendentes</p>
            <p className="text-2xl font-semibold tracking-tight text-[var(--dashboard-warning)]">
              {data.pending}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
            <p className="text-xs font-medium text-[var(--text-secondary)]">Falhas</p>
            <p className="text-2xl font-semibold tracking-tight text-[var(--dashboard-danger)]">
              {data.failed}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Últimas interações
          </p>
          <ul className="space-y-3">
            {data.interactions.slice(0, 3).map(interaction => (
              <li
                key={interaction.id}
                className="flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {interaction.customerName}
                  </p>
                  <p className="truncate text-xs text-[var(--text-secondary)] opacity-80">
                    {interaction.action}
                  </p>
                </div>
                <AppStatusBadge label={getStatusBadgeLabel(interaction.status)} />
              </li>
            ))}
          </ul>
        </div>

        {data.insight ? (
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Insight
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              <span className="text-[var(--text-primary)]">{data.insight}</span>
            </p>
          </div>
        ) : null}
      </div>
    </AppSectionBlock>
  );
}

export type { WhatsAppOverviewCardProps, WhatsAppOverviewData };
