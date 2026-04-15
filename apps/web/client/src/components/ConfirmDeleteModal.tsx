import { Button } from "@/components/design-system";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemName?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteModal({
  isOpen,
  title,
  message,
  itemName,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onCancel() : null)}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md border-[var(--border-subtle)] p-0 shadow-sm"
      >
        <DialogHeader className="border-b border-[var(--border-subtle)] p-6">
          <DialogTitle className="flex items-start gap-3 text-lg text-[var(--text-primary)]">
            <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--color-danger)]" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="p-6">
          <p className="mb-4 text-[var(--text-secondary)]">
            {message}
          </p>
          {itemName && (
            <div className="mb-4 rounded-lg bg-[var(--surface-base)] p-3">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {itemName}
              </p>
            </div>
          )}
          <p className="text-sm text-[var(--text-muted)]">
            Esta ação não pode ser desfeita.
          </p>
        </div>
        <DialogFooter className="flex justify-end gap-3 border-t border-[var(--border-subtle)] p-6">
          <Button
            onClick={onCancel}
            disabled={isLoading}
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            variant="danger"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deletando...
              </>
            ) : (
              "Deletar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
