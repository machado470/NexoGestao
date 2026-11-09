import React, { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AppField,
  AppForm,
  AppInput,
  AppSelect,
} from "@/components/app-system";
import {
  AppPageErrorState,
  AppPageLoadingState,
  AppSectionBlock,
} from "@/components/internal-page-system";
import { ConfirmModal } from "@/components/app-modal-system";
import { OrganizationMemberActions } from "@/components/OrganizationMemberActions";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeObjectPayload } from "@/lib/query-helpers";
import { trpc } from "@/lib/trpc";
import type { Role } from "@/lib/rbac";

type Member = {
  id: string;
  email: string;
  role: Role;
  active: boolean;
  updatedAt?: string;
  person?: { name: string } | null;
};
type Invitation = {
  id: string;
  email: string;
  role: Role;
  status: "PENDING" | "EXPIRED" | "REVOKED";
};
const inviteLabels = {
  PENDING: "Convite pendente",
  EXPIRED: "Convite expirado",
  REVOKED: "Convite revogado",
};
type Members = {
  users: Member[];
  invitations?: Invitation[];
  pendingInvites: { id: string; email: string; role: Role }[];
};
const roles = [
  { value: "ADMIN", label: "Administrador" },
  { value: "MANAGER", label: "Gestor" },
  { value: "STAFF", label: "Operador" },
  { value: "VIEWER", label: "Leitura" },
];

export function OrganizationAccessSection() {
  const { isAuthenticated, role: currentRole, user } = useAuth();
  const utils = trpc.useUtils();
  const query = trpc.invites.members.useQuery(undefined, {
    enabled: isAuthenticated && currentRole === "ADMIN",
    retry: false,
  });
  const members = normalizeObjectPayload<Members>(query.data);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const invite = trpc.invites.invite.useMutation({
    onSuccess: async () => {
      setEmail("");
      await utils.invites.members.invalidate();
      toast.success("Convite enviado por e-mail.");
    },
    onError: error =>
      toast.error(error.message || "Não foi possível enviar o convite."),
  });
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const resend = trpc.invites.resend.useMutation({
    onSuccess: async () => {
      await utils.invites.members.invalidate();
      toast.success(
        "Convite reenviado por e-mail. O link anterior foi substituído."
      );
    },
    onError: error =>
      toast.error(error.message || "Não foi possível reenviar o convite."),
  });
  const revoke = trpc.invites.revoke.useMutation({
    onSuccess: async () => {
      setRevoking(null);
      await utils.invites.members.invalidate();
      toast.success("Convite revogado.");
    },
    onError: error =>
      toast.error(error.message || "Não foi possível revogar o convite."),
  });
  const isMutating = invite.isPending || resend.isPending || revoke.isPending;
  if (currentRole !== "ADMIN") return null;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || isMutating) return;
    invite.mutate({ email: email.trim().toLowerCase(), role });
  };
  return (
    <AppSectionBlock
      title="Acessos da organização"
      subtitle="Consulte os membros e convide usuários com o papel adequado."
    >
      <Button
        type="button"
        variant="outline"
        disabled={query.isFetching || isMutating}
        onClick={() => void query.refetch()}
      >
        Atualizar acessos
      </Button>
      {query.isError && members ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível atualizar os acessos. A lista exibida pode estar
          desatualizada.
        </p>
      ) : null}
      {query.isLoading ? (
        <AppPageLoadingState
          title="Carregando acessos"
          description="Consultando os membros da organização."
        />
      ) : !members ||
        !Array.isArray(members.users) ||
        !Array.isArray(members.pendingInvites) ? (
        <AppPageErrorState
          title="Acessos indisponíveis"
          description="Não foi possível consultar os membros."
          actionLabel="Tentar novamente"
          onAction={() => void query.refetch()}
        />
      ) : (
        <div className="space-y-4">
          {resend.isPending || revoke.isPending ? (
            <p role="status">Atualizando convite...</p>
          ) : null}
          {members.users.length === 0 ? (
            <p>Nenhum membro cadastrado.</p>
          ) : (
            <ul className="space-y-2" aria-label="Membros da organização">
              {members.users.map(member => {
                const invitation = members.invitations?.find(
                  item => item.id === member.id
                );
                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap justify-between gap-2 rounded-md border p-3 text-sm"
                  >
                    <span className="min-w-0 break-all">
                      {member.person?.name || member.email}
                    </span>
                    <span>
                      {roles.find(item => item.value === member.role)?.label ||
                        member.role}{" "}
                      ·{" "}
                      {invitation
                        ? inviteLabels[invitation.status]
                        : members.pendingInvites.some(
                              item => item.id === member.id
                            )
                          ? "Convite pendente"
                          : member.active
                            ? "Ativo"
                            : "Inativo"}
                    </span>
                    {!invitation ? (
                      <OrganizationMemberActions
                        member={member}
                        currentUserId={user?.id}
                      />
                    ) : null}
                    {invitation ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isMutating}
                          onClick={() => resend.mutate({ id: invitation.id })}
                        >
                          Reenviar convite
                        </Button>
                        {invitation.status !== "REVOKED" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isMutating}
                            onClick={() => setRevoking(invitation)}
                          >
                            Revogar convite
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {resend.isError || revoke.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {resend.error?.message ||
                revoke.error?.message ||
                "Não foi possível alterar o convite."}
            </p>
          ) : null}
          <AppForm onSubmit={submit}>
            <AppField label="E-mail do convidado" htmlFor="invite-email">
              <AppInput
                id="invite-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                disabled={isMutating}
                onChange={event => setEmail(event.target.value)}
              />
            </AppField>
            <AppField label="Papel de acesso">
              <AppSelect
                ariaLabel="Papel de acesso"
                value={role}
                options={roles}
                onValueChange={value => setRole(value as Role)}
              />
            </AppField>
            {invite.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {invite.error.message ||
                  "O convite não foi enviado. Tente novamente."}
              </p>
            ) : null}
            <Button type="submit" disabled={!email.trim() || isMutating}>
              {invite.isPending ? "Enviando..." : "Enviar convite"}
            </Button>
          </AppForm>
        </div>
      )}
      <ConfirmModal
        open={Boolean(revoking)}
        onOpenChange={open => {
          if (!open && !revoke.isPending) setRevoking(null);
        }}
        title="Revogar convite"
        description={`O link enviado para ${revoking?.email ?? "este usuário"} deixará de permitir a ativação da conta.`}
        confirmLabel="Revogar convite"
        isPending={revoke.isPending}
        onConfirm={() => {
          if (revoking && !isMutating) revoke.mutate({ id: revoking.id });
        }}
      />
    </AppSectionBlock>
  );
}
