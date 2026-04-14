import type { ReactNode } from "react";
import { Button } from "@/components/design-system";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const modalSizeMap = {
  sm: "sm:max-w-md",
  md: "sm:max-w-2xl",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
  full: "sm:max-w-[96vw]",
} as const;

export function BaseModal({
  open,
  onOpenChange,
  size = "md",
  title,
  description,
  children,
  footer,
  closeBlocked = false,
  fixedHeader = true,
  fixedFooter = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: keyof typeof modalSizeMap;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closeBlocked?: boolean;
  fixedHeader?: boolean;
  fixedFooter?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen && closeBlocked) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        onEscapeKeyDown={event => {
          if (closeBlocked) event.preventDefault();
        }}
        onInteractOutside={event => {
          if (closeBlocked) event.preventDefault();
        }}
        className={cn(
          "flex max-h-[92vh] min-h-[220px] flex-col overflow-hidden p-0",
          modalSizeMap[size]
        )}
      >
        <ModalHeader fixed={fixedHeader}>
          <DialogTitle className="text-lg font-semibold text-[var(--text-primary)]">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-sm text-[var(--text-muted)]">
              {description}
            </DialogDescription>
          ) : null}
        </ModalHeader>

        <ModalBody>{children}</ModalBody>

        {footer ? (
          <ModalFooter fixed={fixedFooter}>{footer}</ModalFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ModalHeader({
  children,
  fixed = true,
}: {
  children: ReactNode;
  fixed?: boolean;
}) {
  return (
    <DialogHeader
      className={cn(
        "border-b border-[var(--border-subtle)] px-6 py-4",
        fixed ? "shrink-0" : ""
      )}
    >
      {children}
    </DialogHeader>
  );
}

export function ModalBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "nexo-modal-body min-h-0 flex-1 overflow-y-auto px-6 py-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ModalFooter({
  children,
  fixed = true,
}: {
  children: ReactNode;
  fixed?: boolean;
}) {
  return (
    <DialogFooter
      className={cn(
        "border-t border-[var(--border-subtle)] px-6 py-4",
        fixed ? "shrink-0" : ""
      )}
    >
      {children}
    </DialogFooter>
  );
}


export function BaseOperationalModal(props: Omit<Parameters<typeof BaseModal>[0], "fixedHeader" | "fixedFooter">) {
  return (
    <BaseModal
      {...props}
      fixedHeader
      fixedFooter
    />
  );
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  isPending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isPending?: boolean;
}) {
  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={title}
      description={description}
      closeBlocked={isPending}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isPending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-[var(--text-secondary)]">
        Esta ação é auditada e pode impactar o fluxo operacional.
      </div>
    </BaseModal>
  );
}

export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "lg",
  closeBlocked = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  size?: keyof typeof modalSizeMap;
  closeBlocked?: boolean;
}) {
  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size={size}
      closeBlocked={closeBlocked}
      footer={footer}
    >
      {children}
    </BaseModal>
  );
}
