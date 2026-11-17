import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { operationalMemoryKey, readOperationalMemory } from "@/lib/operational-memory";

export function useOperationalMemoryState<T>(key: string, initialValue: T) {
  const { user, isAuthenticated } = useAuth();
  const storageKey = isAuthenticated ? operationalMemoryKey(user?.organizationId, user?.id, key) : null;
  const initial = useRef(initialValue);
  const [state, setState] = useState(() => ({ key: storageKey, value: readOperationalMemory(storageKey, initial.current) }));
  // Never render another identity's value, even before effects run after a switch.
  const value = state.key === storageKey ? state.value : readOperationalMemory(storageKey, initial.current);

  useEffect(() => {
    setState(previous => previous.key === storageKey ? previous : { key: storageKey, value: readOperationalMemory(storageKey, initial.current) });
    try { window.localStorage.removeItem(key); } catch { /* Discard unscoped legacy drafts; never migrate across identities. */ }
  }, [storageKey, key]);

  useEffect(() => {
    if (!storageKey || state.key !== storageKey) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(state.value)); } catch { /* Storage failures must not block the operation. */ }
  }, [storageKey, state]);

  const setValue = useCallback((next: SetStateAction<T>) => {
    setState(previous => {
      const current = previous.key === storageKey ? previous.value : readOperationalMemory(storageKey, initial.current);
      return { key: storageKey, value: typeof next === "function" ? (next as (value: T) => T)(current) : next };
    });
  }, [storageKey]);
  return [value, setValue] as const;
}
