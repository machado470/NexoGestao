import { useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";

import {
  AppAlert,
  AppAlertDescription,
  AppAlertTitle,
  AppPageShell,
  AppSectionCard,
  AppStatusBadge,
} from "@/components/app-system";
import {
  AppOperationalHeader,
  AppPageErrorState,
  AppPageLoadingState,
  AppSectionBlock,
} from "@/components/internal-page-system";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "../../../server/routers";

export type TenantFactStatus =
  | "available"
  | "unavailable"
  | "not_configured"
  | "unknown";

const statusLabels: Record<TenantFactStatus, string> = {
  available: "Disponível",
  unavailable: "Indisponível",
  not_configured: "Não configurado",
  unknown: "Não disponível",
};

const reasonLabels: Record<string, string> = {
  TENANT_CONFIGURATION_NOT_OBSERVABLE:
    "A configuração desta organização não pode ser observada por esta fonte.",
  NO_WEBHOOK_ENDPOINTS: "Nenhum endpoint de webhook está configurado.",
  NO_SUBSCRIPTION: "Nenhuma assinatura está configurada.",
  PROVIDER_AVAILABILITY_NOT_OBSERVABLE:
    "A disponibilidade do provedor não é afirmada por esta fonte.",
  NO_OPERATION_CONFIG: "Nenhuma configuração operacional foi encontrada.",
};

export default function OperationalCockpitPage() {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const tenantSummary = trpc.operations.tenantSummary.useQuery(undefined, {
    refetchInterval: autoRefresh ? 30_000 : false,
  });

  const refresh = () => tenantSummary.refetch();

  return (
    <AppPageShell className="gap-4">
      <AppOperationalHeader
        density="compact"
        title="Cockpit Operacional"
        description="Visão operacional da organização"
        primaryAction={
          <Button
            size="sm"
            disabled={tenantSummary.isFetching}
            onClick={() => void refresh()}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Atualizar
          </Button>
        }
        secondaryActions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAutoRefresh(value => !value)}
          >
            {autoRefresh ? "Auto-refresh ligado" : "Auto-refresh desligado"}
          </Button>
        }
      />

      {tenantSummary.isLoading ? (
        <AppPageLoadingState description="Carregando dados operacionais..." />
      ) : null}

      {tenantSummary.error ? (
        <AppPageErrorState
          title="Dados operacionais indisponíveis"
          description="Não foi possível consultar os fatos operacionais desta organização."
          onAction={() => void refresh()}
        />
      ) : null}

      {!tenantSummary.error && tenantSummary.data ? (
        <>
          <AppAlert role="status">
            <AppAlertTitle>Dados da organização</AppAlertTitle>
            <AppAlertDescription>
              Gerados em {formatTimestamp(tenantSummary.data.generatedAt)}. Cada
              seção apresenta somente o fato observado pela respectiva fonte.
            </AppAlertDescription>
          </AppAlert>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ResourcesSection fact={tenantSummary.data.facts[0]} />
            <WhatsAppSection fact={tenantSummary.data.facts[1]} />
            <WebhooksSection fact={tenantSummary.data.facts[2]} />
            <BillingSection fact={tenantSummary.data.facts[3]} />
            <OperationConfigSection fact={tenantSummary.data.facts[4]} />
          </div>
        </>
      ) : null}
    </AppPageShell>
  );
}

type Summary = inferRouterOutputs<AppRouter>["operations"]["tenantSummary"];

function ResourcesSection({ fact }: { fact: Summary["facts"][0] }) {
  const rows = [
    ["Clientes", fact.facts.customersVolume, fact.facts.customersUpdatedAt],
    [
      "Agendamentos",
      fact.facts.appointmentsVolume,
      fact.facts.appointmentsUpdatedAt,
    ],
    [
      "Ordens de serviço",
      fact.facts.serviceOrdersVolume,
      fact.facts.serviceOrdersUpdatedAt,
    ],
    ["Cobranças", fact.facts.chargesVolume, fact.facts.chargesUpdatedAt],
    ["Pagamentos", fact.facts.paymentsVolume, fact.facts.paymentsUpdatedAt],
  ] as const;

  return (
    <FactSection title="Recursos" fact={fact} statusContext="Fonte de recursos">
      {rows.map(([label, value, updatedAt]) => (
        <FactRow
          key={label}
          label={label}
          value={formatNullable(value)}
          detail={
            updatedAt
              ? `Atualizado em ${formatTimestamp(updatedAt)}`
              : undefined
          }
        />
      ))}
    </FactSection>
  );
}

function WhatsAppSection({ fact }: { fact: Summary["facts"][1] }) {
  return (
    <FactSection
      title="WhatsApp"
      fact={fact}
      statusContext="Observação do WhatsApp"
    >
      <FactRow
        label="Mensagens com falha observadas"
        value={
          fact.facts.failedMessages === null
            ? "Não disponível"
            : `${fact.facts.failedMessages} mensagens com falha observadas`
        }
      />
    </FactSection>
  );
}

function WebhooksSection({ fact }: { fact: Summary["facts"][2] }) {
  const rows = [
    ["Endpoints configurados", fact.facts.configuredEndpoints],
    ["Endpoints ativos", fact.facts.activeEndpoints],
    ["Entregas pendentes", fact.facts.pendingDeliveries],
    ["Entregas concluídas", fact.facts.successfulDeliveries],
    ["Entregas com falha", fact.facts.failedDeliveries],
  ] as const;
  return (
    <FactSection
      title="Webhooks"
      fact={fact}
      statusContext="Configuração de webhooks"
    >
      {fact.status === "unknown" ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Disponibilidade não observável
        </p>
      ) : null}
      {rows.map(([label, value]) => (
        <FactRow key={label} label={label} value={formatNullable(value)} />
      ))}
    </FactSection>
  );
}

function BillingSection({ fact }: { fact: Summary["facts"][3] }) {
  return (
    <FactSection
      title="Cobrança"
      fact={fact}
      statusContext="Configuração da assinatura"
    >
      <FactRow
        label="Status da assinatura"
        value={fact.facts.subscriptionStatus ?? "Não configurado"}
      />
      {fact.facts.subscriptionStatus && fact.status === "unknown" ? (
        <p className="text-xs text-[var(--text-secondary)]">
          O status acima é o registro da assinatura; a disponibilidade do
          provedor não está sendo afirmada.
        </p>
      ) : null}
    </FactSection>
  );
}

function OperationConfigSection({ fact }: { fact: Summary["facts"][4] }) {
  return (
    <FactSection
      title="Configuração operacional"
      fact={fact}
      statusContext="Configuração disponível"
    >
      <FactRow
        label="Modo de execução"
        value={fact.facts.executionMode ?? "Não configurado"}
      />
      <FactRow
        label="Atualização da configuração"
        value={
          fact.facts.updatedAt
            ? formatTimestamp(fact.facts.updatedAt)
            : "Não disponível"
        }
      />
    </FactSection>
  );
}

function FactSection({
  title,
  fact,
  statusContext,
  children,
}: {
  title: string;
  fact: {
    status: TenantFactStatus;
    observedAt: string;
    reasonCode: string | null;
  };
  statusContext: string;
  children: ReactNode;
}) {
  return (
    <AppSectionBlock
      title={title}
      subtitle={`Observado em ${formatTimestamp(fact.observedAt)}`}
      compact
    >
      <AppSectionCard className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--text-secondary)]">
            {statusContext}
          </span>
          <AppStatusBadge label={statusLabel(fact.status)} tone="neutral" />
        </div>
        {fact.reasonCode ? (
          <p className="text-xs text-[var(--text-secondary)]">
            {reasonDescription(fact.reasonCode)}
          </p>
        ) : null}
        <div className="space-y-2">{children}</div>
      </AppSectionCard>
    </AppSectionBlock>
  );
}

function FactRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-[var(--border-subtle)] pt-2 first:border-0 first:pt-0">
      <div>
        <p className="text-sm text-[var(--text-primary)]">{label}</p>
        {detail ? (
          <p className="text-xs text-[var(--text-secondary)]">{detail}</p>
        ) : null}
      </div>
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}

export function statusLabel(status: TenantFactStatus) {
  return statusLabels[status];
}

export function reasonDescription(reasonCode: string) {
  return (
    reasonLabels[reasonCode] ??
    `Informação adicional não disponível (${reasonCode}).`
  );
}

export function formatNullable(value: number | null) {
  return value === null ? "Não disponível" : String(value);
}

export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}
