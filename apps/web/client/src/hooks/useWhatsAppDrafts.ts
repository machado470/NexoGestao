import { useCallback, useEffect, useRef, useState } from "react";
import {
  persistWhatsAppDrafts,
  readWhatsAppDrafts,
  whatsappDraftStorageKey,
} from "@/lib/whatsapp-draft-storage";

export function useWhatsAppDrafts(
  user: { id?: string; organizationId?: string } | null,
  conversationId: string | null
) {
  const key = whatsappDraftStorageKey(user);
  const currentKey = useRef(key);
  currentKey.current = key;
  const [state, setState] = useState(() => ({ key, drafts: readWhatsAppDrafts(key) }));

  // A troca de identidade descarta o estado anterior antes de renderizar o compositor.
  if (state.key !== key) {
    setState({ key, drafts: readWhatsAppDrafts(key) });
  }

  useEffect(() => {
    if (state.key === key) persistWhatsAppDrafts(key, state.drafts);
  }, [key, state]);

  const setContent = useCallback((content: string) => {
    if (!key || !conversationId || currentKey.current !== key) return;
    setState(previous => previous.key === key
      ? { key, drafts: { ...previous.drafts, [conversationId]: content } }
      : previous);
  }, [key, conversationId]);

  const content = key && state.key === key && conversationId
    ? state.drafts[conversationId] ?? ""
    : "";
  return [content, setContent] as const;
}
