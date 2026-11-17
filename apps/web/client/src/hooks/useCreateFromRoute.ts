import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { can, type Permission } from "@/lib/rbac";

/** Consume an explicit shortcut once, retaining the module's other filters. */
export function useCreateFromRoute(
  permission: Permission,
  setOpen: (open: boolean) => void
) {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const { role } = useAuth();
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (!role || params.get("action") !== "create") return;
    if (can(role, permission)) setOpen(true);
    params.delete("action");
    const remaining = params.toString();
    navigate(location + (remaining ? `?${remaining}` : ""), { replace: true });
  }, [location, navigate, permission, role, search, setOpen]);
}
