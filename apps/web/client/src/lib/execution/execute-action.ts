import type {
  ExecuteActionContext,
  ExecuteActionResult,
  ExecutionAction,
} from "@/lib/execution/types";

export type ExecuteActionAdapters = {
  navigate: (path: string) => void;
  openExternal: (url: string) => void;
  mutate?: (mutationKey: string, payload?: Record<string, unknown>) => Promise<void>;
};

export async function executeExecutionAction(
  action: ExecutionAction,
  _context: ExecuteActionContext,
  adapters: ExecuteActionAdapters
): Promise<ExecuteActionResult> {
  if (!action.enabled) {
    return {
      ok: false,
      status: "blocked",
      message: action.disabledReason || "Ação indisponível no momento.",
    };
  }

  try {
    if (action.kind === "navigate") {
      if (!action.target) {
        return {
          ok: false,
          status: "failed",
          message: "Destino de navegação não informado.",
        };
      }

      adapters.navigate(action.target);
      return { ok: true, status: "executed" };
    }

    if (action.kind === "external") {
      if (!action.externalUrl) {
        return {
          ok: false,
          status: "failed",
          message: "URL externa não informada.",
        };
      }

      adapters.openExternal(action.externalUrl);
      return { ok: true, status: "executed" };
    }

    if (action.kind === "mutation") {
      if (!action.mutationKey) {
        return {
          ok: false,
          status: "failed",
          message: "Mutation sem chave identificadora.",
        };
      }

      if (!adapters.mutate) {
        return {
          ok: false,
          status: "unsupported",
          message: "Mutation ainda não suportada nesta versão.",
        };
      }

      await adapters.mutate(action.mutationKey, action.payload);
      return { ok: true, status: "executed" };
    }

    if (action.kind === "future") {
      return {
        ok: false,
        status: "unsupported",
        message: "Ação reservada para automação futura.",
      };
    }

    return {
      ok: false,
      status: "unsupported",
      message: "Tipo de ação não suportado.",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao executar ação.";

    return {
      ok: false,
      status: "failed",
      message,
    };
  }
}
