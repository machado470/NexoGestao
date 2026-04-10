export type ExecutionFlowActionId =
  | "complete_service"
  | "generate_charge"
  | "send_whatsapp"
  | "receive_payment"
  | "confirm_payment";

export type ExecutionFlowStatus = "pending" | "running" | "success" | "failed";
export type ExecutionCriticality = "low" | "medium" | "high";

export type ExecutionFlowSuggestion = {
  actionId: ExecutionFlowActionId;
  label: string;
  reason: string;
};

export type ExecutionSnapshot = {
  actionId: ExecutionFlowActionId;
  label: string;
  status: ExecutionFlowStatus;
  timestamp: string;
  message?: string;
  error?: string;
};

export type ExecutionFlowResult = {
  completedAction: string;
  executedActionIds: ExecutionFlowActionId[];
  suggestions: ExecutionFlowSuggestion[];
  snapshots: ExecutionSnapshot[];
  latestStatus: ExecutionFlowStatus;
  canRetry: boolean;
};

type ExecutionFlowNode = {
  id: ExecutionFlowActionId;
  label: string;
  run: () => Promise<void> | void;
  suggestNext: () => ExecutionFlowSuggestion[];
  criticality?: ExecutionCriticality;
};

type ActionFacts = {
  hasOpenCharge?: boolean;
  isChargePaid?: boolean;
  hasRecentMessage?: boolean;
};

type NextActionHistoryItem = {
  actionId: ExecutionFlowActionId;
  status: ExecutionFlowStatus;
};

const inFlightExecution = new Set<string>();
const completedExecution = new Set<string>();

function createSnapshot(input: {
  actionId: ExecutionFlowActionId;
  label: string;
  status: ExecutionFlowStatus;
  message?: string;
  error?: string;
}) {
  return {
    actionId: input.actionId,
    label: input.label,
    status: input.status,
    timestamp: new Date().toISOString(),
    message: input.message,
    error: input.error,
  } satisfies ExecutionSnapshot;
}

function buildActionSuggestions(actionId: ExecutionFlowActionId, facts: ActionFacts): ExecutionFlowSuggestion[] {
  if (actionId === "complete_service") {
    if (!facts.hasOpenCharge) {
      return [
        {
          actionId: "generate_charge",
          label: "Gerar cobrança",
          reason: "Serviço concluído sem cobrança aberta.",
        },
      ];
    }

    return [
      {
        actionId: "send_whatsapp",
        label: "Enviar mensagem de atualização",
        reason: "Já existe cobrança aberta; avance com comunicação ao cliente.",
      },
    ];
  }

  if (actionId === "generate_charge") {
    if (facts.hasRecentMessage) return [];
    return [
      {
        actionId: "send_whatsapp",
        label: "Enviar cobrança por WhatsApp",
        reason: "Cobrança criada e ainda não comunicada ao cliente.",
      },
    ];
  }

  if (actionId === "receive_payment") {
    if (facts.isChargePaid) {
      return [
        {
          actionId: "confirm_payment",
          label: "Enviar confirmação de pagamento",
          reason: "Pagamento identificado; confirme o recebimento com o cliente.",
        },
      ];
    }
    return [];
  }

  return [];
}

export function classifyActionCriticality(actionId: ExecutionFlowActionId): ExecutionCriticality {
  if (actionId === "generate_charge" || actionId === "receive_payment") return "high";
  if (actionId === "complete_service" || actionId === "confirm_payment") return "medium";
  return "low";
}

export function shouldRequireExplicitConfirmation(criticality: ExecutionCriticality) {
  return criticality === "high";
}

export function shouldRequireLightConfirmation(criticality: ExecutionCriticality) {
  return criticality === "medium";
}

export function buildNextActionSuggestions(options: {
  actionId: ExecutionFlowActionId;
  facts?: ActionFacts;
  history?: NextActionHistoryItem[];
}) {
  const facts = options.facts ?? {};
  const history = options.history ?? [];
  const recentlySuccessful = new Set(
    history.filter(item => item.status === "success").map(item => item.actionId)
  );

  return buildActionSuggestions(options.actionId, facts).filter(
    suggestion => !recentlySuccessful.has(suggestion.actionId)
  );
}

export async function runActionChain(options: {
  actionLabel: string;
  actionId: ExecutionFlowActionId;
  nodes: Record<ExecutionFlowActionId, ExecutionFlowNode>;
  executionKey?: string;
  onConfirm?: (context: { actionId: ExecutionFlowActionId; label: string; criticality: ExecutionCriticality }) => Promise<boolean> | boolean;
}) {
  const snapshots: ExecutionSnapshot[] = [];
  const executionKey = options.executionKey ?? `flow:${options.actionId}`;

  if (completedExecution.has(executionKey)) {
    const node = options.nodes[options.actionId];
    snapshots.push(
      createSnapshot({
        actionId: options.actionId,
        label: node.label,
        status: "success",
        message: "Execução idempotente: ação já concluída anteriormente.",
      })
    );

    return {
      completedAction: options.actionLabel,
      executedActionIds: [options.actionId],
      suggestions: node.suggestNext(),
      snapshots,
      latestStatus: "success",
      canRetry: false,
    } satisfies ExecutionFlowResult;
  }

  if (inFlightExecution.has(executionKey)) {
    const node = options.nodes[options.actionId];
    snapshots.push(
      createSnapshot({
        actionId: options.actionId,
        label: node.label,
        status: "failed",
        error: "Execução duplicada bloqueada: já existe uma execução em andamento para esta ação.",
      })
    );

    return {
      completedAction: options.actionLabel,
      executedActionIds: [],
      suggestions: [],
      snapshots,
      latestStatus: "failed",
      canRetry: true,
    } satisfies ExecutionFlowResult;
  }

  inFlightExecution.add(executionKey);

  const visited = new Set<ExecutionFlowActionId>();
  const queue: ExecutionFlowActionId[] = [options.actionId];
  const executedActionIds: ExecutionFlowActionId[] = [];
  let latestStatus: ExecutionFlowStatus = "pending";

  try {
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);

      const node = options.nodes[current];
      const criticality = node.criticality ?? classifyActionCriticality(current);

      snapshots.push(createSnapshot({ actionId: current, label: node.label, status: "pending" }));

      if (options.onConfirm && (shouldRequireLightConfirmation(criticality) || shouldRequireExplicitConfirmation(criticality))) {
        const allowed = await options.onConfirm({
          actionId: current,
          label: node.label,
          criticality,
        });

        if (!allowed) {
          latestStatus = "failed";
          snapshots.push(
            createSnapshot({
              actionId: current,
              label: node.label,
              status: "failed",
              error:
                criticality === "high"
                  ? "Ação crítica cancelada por falta de confirmação explícita."
                  : "Ação cancelada: confirmação leve não concedida.",
            })
          );
          continue;
        }
      }

      snapshots.push(createSnapshot({ actionId: current, label: node.label, status: "running" }));

      try {
        await node.run();
        latestStatus = "success";
        executedActionIds.push(current);
        snapshots.push(createSnapshot({ actionId: current, label: node.label, status: "success" }));
      } catch (error) {
        latestStatus = "failed";
        snapshots.push(
          createSnapshot({
            actionId: current,
            label: node.label,
            status: "failed",
            error: error instanceof Error ? error.message : "Falha desconhecida na execução.",
          })
        );
        continue;
      }

      const next = node.suggestNext();
      next.forEach((item) => {
        if (!visited.has(item.actionId)) {
          queue.push(item.actionId);
        }
      });
    }
  } finally {
    inFlightExecution.delete(executionKey);
  }

  if (latestStatus === "success") {
    completedExecution.add(executionKey);
  }

  const lastNode = options.nodes[executedActionIds[executedActionIds.length - 1] ?? options.actionId];
  return {
    completedAction: options.actionLabel,
    executedActionIds,
    suggestions: lastNode.suggestNext(),
    snapshots,
    latestStatus,
    canRetry: latestStatus === "failed",
  } satisfies ExecutionFlowResult;
}

export async function runFlowChain(options: {
  actionLabel: string;
  onExecute: () => Promise<void> | void;
  onSuccess?: () => Promise<void> | void;
  actionId?: ExecutionFlowActionId;
  criticality?: ExecutionCriticality;
  executionKey?: string;
  facts?: ActionFacts;
  history?: NextActionHistoryItem[];
  nextSuggestedAction?: string;
  onConfirm?: (context: { actionId: ExecutionFlowActionId; label: string; criticality: ExecutionCriticality }) => Promise<boolean> | boolean;
  throwOnError?: boolean;
}) {
  const actionId = options.actionId ?? "complete_service";
  const criticality = options.criticality ?? classifyActionCriticality(actionId);
  const executionKey = options.executionKey ?? `flow:${actionId}:${options.actionLabel}`;

  if (completedExecution.has(executionKey)) {
    return {
      completedAction: options.actionLabel,
      executedActionIds: [actionId],
      suggestions: buildNextActionSuggestions({ actionId, facts: options.facts, history: options.history }),
      snapshots: [
        createSnapshot({
          actionId,
          label: options.actionLabel,
          status: "success",
          message: "Execução idempotente: ação já processada.",
        }),
      ],
      latestStatus: "success",
      canRetry: false,
    } satisfies ExecutionFlowResult;
  }

  if (inFlightExecution.has(executionKey)) {
    return {
      completedAction: options.actionLabel,
      executedActionIds: [],
      suggestions: [],
      snapshots: [
        createSnapshot({
          actionId,
          label: options.actionLabel,
          status: "failed",
          error: "Execução já em andamento para esta ação.",
        }),
      ],
      latestStatus: "failed",
      canRetry: true,
    } satisfies ExecutionFlowResult;
  }

  const snapshots: ExecutionSnapshot[] = [
    createSnapshot({ actionId, label: options.actionLabel, status: "pending" }),
  ];

  if (options.onConfirm && (shouldRequireLightConfirmation(criticality) || shouldRequireExplicitConfirmation(criticality))) {
    const allowed = await options.onConfirm({ actionId, label: options.actionLabel, criticality });
    if (!allowed) {
      return {
        completedAction: options.actionLabel,
        executedActionIds: [],
        suggestions: [],
        snapshots: [
          ...snapshots,
          createSnapshot({
            actionId,
            label: options.actionLabel,
            status: "failed",
            error:
              criticality === "high"
                ? "Ação crítica cancelada por falta de confirmação explícita."
                : "Ação cancelada sem confirmação.",
          }),
        ],
        latestStatus: "failed",
        canRetry: true,
      } satisfies ExecutionFlowResult;
    }
  }

  inFlightExecution.add(executionKey);
  snapshots.push(createSnapshot({ actionId, label: options.actionLabel, status: "running" }));

  try {
    await options.onExecute();
    if (options.onSuccess) await options.onSuccess();
    completedExecution.add(executionKey);

    const suggestions = options.nextSuggestedAction
      ? [
          {
            actionId: "generate_charge" as const,
            label: options.nextSuggestedAction,
            reason: "Sequência sugerida",
          },
        ]
      : buildNextActionSuggestions({
          actionId,
          facts: options.facts,
          history: options.history,
        });

    return {
      completedAction: options.actionLabel,
      executedActionIds: [actionId],
      suggestions,
      snapshots: [...snapshots, createSnapshot({ actionId, label: options.actionLabel, status: "success" })],
      latestStatus: "success",
      canRetry: false,
    } satisfies ExecutionFlowResult;
  } catch (error) {
    const failedResult = {
      completedAction: options.actionLabel,
      executedActionIds: [],
      suggestions: [],
      snapshots: [
        ...snapshots,
        createSnapshot({
          actionId,
          label: options.actionLabel,
          status: "failed",
          error: error instanceof Error ? error.message : "Falha desconhecida na execução.",
        }),
      ],
      latestStatus: "failed",
      canRetry: true,
    } satisfies ExecutionFlowResult;
    if (options.throwOnError ?? true) {
      throw error;
    }
    return failedResult;
  } finally {
    inFlightExecution.delete(executionKey);
  }
}

export async function retryFlowChain(options: Parameters<typeof runFlowChain>[0]) {
  return runFlowChain(options);
}
