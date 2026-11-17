import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** All dismiss paths share one decision; successful saves close directly. */
export function useFormDiscardGuard({
  open,
  dirty,
  blocked,
  onDiscard,
}: {
  open: boolean;
  dirty: boolean;
  blocked: boolean;
  onDiscard: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const discarding = useRef(false);

  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);

  useEffect(() => {
    if (!open || !dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [open, dirty]);

  const requestClose = () => {
    if (blocked) return;
    if (!dirty) {
      onDiscard();
      return;
    }
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    discarding.current = false;
    setConfirming(true);
  };

  const confirmation = (
    <AlertDialog open={open && confirming} onOpenChange={setConfirming}>
      <AlertDialogContent
        onCloseAutoFocus={event => {
          if (!discarding.current && returnFocus.current?.isConnected) {
            event.preventDefault();
            returnFocus.current.focus();
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
          <AlertDialogDescription>
            Há dados não salvos neste formulário. Continue editando para
            mantê-los ou descarte para fechar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11">
            Continuar editando
          </AlertDialogCancel>
          <AlertDialogAction
            className="min-h-11"
            disabled={blocked}
            onClick={event => {
              if (blocked) {
                event.preventDefault();
                return;
              }
              discarding.current = true;
              setConfirming(false);
              onDiscard();
            }}
          >
            Descartar alterações
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { requestClose, confirmation };
}
