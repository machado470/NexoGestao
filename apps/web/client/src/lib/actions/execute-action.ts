import type { AppAction, AppActionResult } from "@/lib/actions/types";

export type ActionHandlerAdapters = {
  navigate: (path: string) => void;
  openExternal: (url: string, target?: "_blank" | "_self") => void;
  mutate: (
    mutationKey: string,
    payload?: Record<string, unknown>
  ) => Promise<{ message?: string } | void>;
};

export async function executeAction(
  action: AppAction,
  adapters: ActionHandlerAdapters
): Promise<AppActionResult> {
  try {
    if (action.type === "navigate") {
      adapters.navigate(action.payload.path);
      if (action.onSuccess) await executeAction(action.onSuccess, adapters);
      return { ok: true, actionId: action.id };
    }

    if (action.type === "external") {
      adapters.openExternal(action.payload.url, action.payload.target);
      if (action.onSuccess) await executeAction(action.onSuccess, adapters);
      return { ok: true, actionId: action.id };
    }

    if (action.type === "mutation") {
      const result = await adapters.mutate(
        action.payload.mutationKey,
        action.payload.data
      );
      if (action.onSuccess) await executeAction(action.onSuccess, adapters);
      return {
        ok: true,
        actionId: action.id,
        message: result?.message,
      };
    }

    for (const step of action.payload.actions) {
      const result = await executeAction(step, adapters);
      if (!result.ok) {
        if (action.onError) await executeAction(action.onError, adapters);
        return { ...result, actionId: action.id };
      }
    }

    if (action.onSuccess) await executeAction(action.onSuccess, adapters);
    return { ok: true, actionId: action.id };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Falha na execução da ação.";

    if (action.onError) await executeAction(action.onError, adapters);

    return {
      ok: false,
      actionId: action.id,
      error: errorMessage,
    };
  }
}
