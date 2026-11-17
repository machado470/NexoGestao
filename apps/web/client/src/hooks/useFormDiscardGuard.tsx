import { registerNavigationBlocker } from "@/lib/navigation-guard";
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
  guardNavigation = false,
}: {
  open: boolean;
  dirty: boolean;
  blocked: boolean;
  onDiscard: () => void;
  guardNavigation?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const discarding = useRef(false);
  const pendingNavigation = useRef<(() => void) | undefined>(undefined);
  const latest = useRef({ blocked, dirty });
  latest.current = { blocked, dirty };

  useEffect(() => {
    if (!guardNavigation || !open || (!dirty && !blocked)) return;
    return registerNavigationBlocker(proceed => {
      if (latest.current.blocked) return;
      if (!latest.current.dirty) {
        proceed();
        return;
      }
      // Keep the first destination until the person makes a decision.
      if (pendingNavigation.current) return;
      pendingNavigation.current = proceed;
      returnFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      discarding.current = false;
      setConfirming(true);
    });
  }, [guardNavigation, open, dirty, blocked]);

  useEffect(() => {
    if (!open || (guardNavigation && !dirty && !blocked)) {
      pendingNavigation.current = undefined;
      setConfirming(false);
    }
  }, [open, guardNavigation, dirty, blocked]);

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
    // An underlying modal can receive the same Escape; preserve the original focus.
    if (blocked || confirming) return;
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
    <AlertDialog
      open={open && confirming}
      onOpenChange={next => {
        setConfirming(next);
        if (!next) pendingNavigation.current = undefined;
      }}
    >
      <AlertDialogContent
        onKeyDownCapture={event => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          pendingNavigation.current = undefined;
          setConfirming(false);
        }}
        onEscapeKeyDown={event => {
          // Consume Escape here so an underlying form cannot reopen this prompt.
          event.preventDefault();
          event.stopPropagation();
          pendingNavigation.current = undefined;
          setConfirming(false);
        }}
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
            mantê-los ou confirme o descarte para continuar.
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
              const proceed = pendingNavigation.current;
              pendingNavigation.current = undefined;
              onDiscard();
              proceed?.();
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
