import { useMemo } from "react";
import { useLocation } from "wouter";
import { User, Settings, ShieldCheck, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleLabel } from "@/lib/rbac";
import {
  AppPageShell,
  AppPageHeader,
  AppSectionCard,
  AppStatusBadge,
  AppEntityContextPanel,
} from "@/components/app-system";
import { Button } from "@/components/design-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";

export default function ProfilePage() {
  const { user, role } = useAuth();
  const [, navigate] = useLocation();

  const roleLabel = useMemo(() => {
    if (!role) return "Sem perfil";
    return getRoleLabel(role);
  }, [role]);

  return (
    <PageWrapper
      title="Perfil"
      subtitle="Identidade operacional do usuário dentro do cockpit."
    >
      <AppPageShell>
        <AppPageHeader className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Identidade de acesso
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {user?.name || "Usuário interno"}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Perfil usado para decisões, trilhas e permissões da operação.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Abrir configurações
          </Button>
        </AppPageHeader>

        <section className="grid gap-3 md:grid-cols-3">
          <AppSectionCard className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Nome
            </p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {user?.name || "Não informado"}
            </p>
          </AppSectionCard>
          <AppSectionCard className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              E-mail
            </p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {user?.email || "Não informado"}
            </p>
          </AppSectionCard>
          <AppSectionCard className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Nível
            </p>
            <div>
              <AppStatusBadge
                tone={role === "ADMIN" ? "success" : "info"}
                label={roleLabel}
              />
            </div>
          </AppSectionCard>
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <AppSectionCard className="space-y-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Leitura rápida do perfil
            </p>
            <div className="space-y-2">
              <div className="nexo-subtle-surface p-3 text-sm">
                <User className="mr-2 inline h-4 w-4" />
                Identidade exibida no cockpit e registros de atividade.
              </div>
              <div className="nexo-subtle-surface p-3 text-sm">
                <Mail className="mr-2 inline h-4 w-4" />
                E-mail usado para acesso e comunicações institucionais.
              </div>
              <div className="nexo-subtle-surface p-3 text-sm">
                <ShieldCheck className="mr-2 inline h-4 w-4" />
                Permissões controlam quais módulos e ações ficam disponíveis.
              </div>
            </div>
          </AppSectionCard>

          <AppEntityContextPanel
            title="Fluxo conectado do perfil"
            links={[
              { id: "profile", label: "Perfil", href: "/profile", active: true },
              { id: "settings", label: "Configurações", href: "/settings" },
              { id: "governance", label: "Governança", href: "/governance" },
            ]}
          />
        </section>
      </AppPageShell>
    </PageWrapper>
  );
}
