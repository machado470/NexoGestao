export type FlowChainResult = {
  completedAction: string;
  nextSuggestedAction?: string;
};

export async function runFlowChain(options: {
  actionLabel: string;
  onExecute: () => Promise<void> | void;
  onSuccess?: () => Promise<void> | void;
  nextSuggestedAction?: string;
}) {
  await options.onExecute();
  if (options.onSuccess) {
    await options.onSuccess();
  }

  const result: FlowChainResult = {
    completedAction: options.actionLabel,
    nextSuggestedAction: options.nextSuggestedAction,
  };

  return result;
}
