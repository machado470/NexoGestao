import { Button } from "@/components/ui/button";
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
        className="max-w-md border-zinc-800/80 bg-white p-0 shadow-lg dark:bg-gray-800"
      >
        <DialogHeader className="border-b border-gray-200 p-6 dark:border-gray-700">
          <DialogTitle className="flex items-start gap-3 text-lg text-gray-900 dark:text-white">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {message}
          </p>
          {itemName && (
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {itemName}
              </p>
            </div>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Esta ação não pode ser desfeita.
          </p>
        </div>
        <DialogFooter className="flex justify-end gap-3 border-t border-gray-200 p-6 dark:border-gray-700">
          <Button
            onClick={onCancel}
            disabled={isLoading}
            variant="outline"
            className="text-gray-700 dark:text-gray-300"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 text-white"
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
