import { useCallback, useEffect, useRef, useState } from "react";

/** Keep desktop master/detail layout while giving phones a focused, reversible view. */
export function useMobileDetailNavigation(routeId?: string | null) {
  const [isOpen, setOpen] = useState(Boolean(routeId));
  const anchorRef = useRef<HTMLElement>(null);
  const originRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (routeId) setOpen(true);
  }, [routeId]);
  const open = useCallback(() => {
    originRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setOpen(true);
    requestAnimationFrame(() =>
      anchorRef.current?.scrollIntoView({ block: "start" })
    );
  }, []);
  const back = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => {
      if (originRef.current?.isConnected) originRef.current.focus();
      else anchorRef.current?.scrollIntoView({ block: "start" });
    });
  }, []);
  return {
    isOpen,
    open,
    back,
    anchorRef,
    listClass: isOpen ? "hidden md:block" : "",
    detailClass: isOpen ? "" : "hidden md:block",
  };
}
