import React, { useState } from "react";
import { toast } from "sonner";
import { FormModal, ConfirmModal } from "@/components/app-modal-system";
import {
  AppField,
  AppForm,
  AppFormActions,
  AppSelect,
} from "@/components/app-system";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import type { Role } from "@/lib/rbac";

export type AccessMember = {
  id: string;
  email: string;
  role: Role;
  active: boolean;
  updatedAt?: string;
  person?: { name: string } | null;
};
const options = [
  { value: "ADMIN", label: "Administrador" },
  { value: "MANAGER", label: "Gestor" },
  { value: "STAFF", label: "Operador" },
  { value: "VIEWER", label: "Leitura" },
];

export function OrganizationMemberActions({
  member,
  currentUserId,
}: {
  member: AccessMember;
  currentUserId?: string;
}) {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [target, setTarget] = useState<AccessMember | null>(null);
  const [role, setRole] = useState<Role>(member.role);
  const update = trpc.invites.updateMember.useMutation({
    onSuccess: async () => {
      setEditing(false);
      setConfirming(false);
      toast.success("Acesso do membro atualizado.");
      try {
        await utils.invites.members.fetch(undefined, { staleTime: 0 });
      } catch {
        toast.warning(
          "Acesso atualizado. Não foi possível atualizar a lista; use Atualizar acessos."
        );
      }
    },
    onError: error =>
      toast.error(error.message || "Não foi possível atualizar o acesso."),
  });
  if (!member.person || !member.updatedAt) return null;
  if (member.id === currentUserId)
    return (
      <p className="text-xs text-muted-foreground">
        Para alterar seu próprio acesso, peça a outro administrador.
      </p>
    );
  const save = (change: { role?: Role; active?: boolean }) => {
    if (update.isPending || !target?.updatedAt) return;
    update.mutate({
      id: target.id,
      expectedUpdatedAt: target.updatedAt,
      ...change,
    });
  };
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={update.isPending}
          onClick={() => {
            setTarget({ ...member });
            setRole(member.role);
            update.reset();
            setEditing(true);
          }}
        >
          Alterar papel
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={update.isPending}
          onClick={() => {
            update.reset();
            setTarget({ ...member });
            setConfirming(true);
          }}
        >
          {member.active ? "Desativar acesso" : "Ativar acesso"}
        </Button>
        {update.isPending ? <p role="status">Atualizando acesso...</p> : null}
        {update.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {update.error.message}
          </p>
        ) : null}
      </div>
      <FormModal
        open={editing}
        onOpenChange={open => {
          if (!update.isPending) setEditing(open);
        }}
        closeBlocked={update.isPending}
        footer={
          <AppFormActions>
            <Button
              type="button"
              variant="outline"
              disabled={update.isPending}
              onClick={() => setEditing(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form={`member-role-${member.id}`}
              disabled={update.isPending || role === target?.role}
            >
              {update.isPending ? "Salvando..." : "Salvar papel"}
            </Button>
          </AppFormActions>
        }
        title="Alterar papel de acesso"
        description={`Defina as permissões de ${target?.email ?? member.email}. A função operacional da pessoa não será alterada.`}
      >
        <AppForm
          id={`member-role-${member.id}`}
          onSubmit={event => {
            event.preventDefault();
            if (role !== target?.role) save({ role });
          }}
        >
          <AppField label="Papel de acesso">
            <AppSelect
              ariaLabel={`Papel de ${member.email}`}
              value={role}
              options={options}
              onValueChange={value => {
                if (!update.isPending) setRole(value as Role);
              }}
            />
          </AppField>
          {update.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {update.error.message}
            </p>
          ) : null}
        </AppForm>
      </FormModal>
      <ConfirmModal
        open={confirming}
        onOpenChange={open => {
          if (!update.isPending) setConfirming(open);
        }}
        isPending={update.isPending}
        title={target?.active ? "Desativar acesso" : "Ativar acesso"}
        description={
          target?.active
            ? `${target?.email} perderá acesso ao sistema. O histórico e as atribuições operacionais serão preservados.`
            : `Restabelecer o acesso de ${target?.email} com o papel atual?`
        }
        confirmLabel={target?.active ? "Desativar acesso" : "Ativar acesso"}
        onConfirm={() => save({ active: !target?.active })}
      />
    </>
  );
}
