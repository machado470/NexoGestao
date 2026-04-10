export type ExecutionFlowActionId =
  | "complete_service"
  | "generate_charge"
  | "send_whatsapp"
  | "receive_payment"
  | "confirm_payment";

export type ExecutionFlowSuggestion = {
  actionId: ExecutionFlowActionId;
  label: string;
  reason: string;
};

export type ExecutionFlowResult = {
  completedAction: string;
  executedActionIds: ExecutionFlowActionId[];
  suggestions: ExecutionFlowSuggestion[];
};

type ExecutionFlowNode = {
  id: ExecutionFlowActionId;
  label: string;
  run: () => Promise<void> | void;
  suggestNext: () => ExecutionFlowSuggestion[];
};

export async function runActionChain(options: {
  actionLabel: string;
  actionId: ExecutionFlowActionId;
  nodes: Record<ExecutionFlowActionId, ExecutionFlowNode>;
}) {
  const visited = new Set<ExecutionFlowActionId>();
  const queue: ExecutionFlowActionId[] = [options.actionId];
  const executedActionIds: ExecutionFlowActionId[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const node = options.nodes[current];
    await node.run();
    executedActionIds.push(current);

    const next = node.suggestNext();
    next.forEach((item) => {
      if (!visited.has(item.actionId)) {
        queue.push(item.actionId);
      }
    });
  }

  const lastNode = options.nodes[executedActionIds[executedActionIds.length - 1] ?? options.actionId];
  return {
    completedAction: options.actionLabel,
    executedActionIds,
    suggestions: lastNode.suggestNext(),
  } satisfies ExecutionFlowResult;
}

export async function runFlowChain(options: {
  actionLabel: string;
  onExecute: () => Promise<void> | void;
  onSuccess?: () => Promise<void> | void;
  nextSuggestedAction?: string;
}) {
  await options.onExecute();
  if (options.onSuccess) await options.onSuccess();

  return {
    completedAction: options.actionLabel,
    executedActionIds: [],
    suggestions: options.nextSuggestedAction
      ? [
          {
            actionId: "generate_charge" as const,
            label: options.nextSuggestedAction,
            reason: "Sequência sugerida",
          },
        ]
      : [],
  } satisfies ExecutionFlowResult;
}
