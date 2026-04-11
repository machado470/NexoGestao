export type AppActionType = "navigate" | "mutation" | "external" | "composite";

export type AppActionMutationKey =
  | "service_order.generate_charge"
  | "finance.charge.mark_paid"
  | "appointment.confirm";

export type AppActionBase = {
  id: string;
  type: AppActionType;
  entityType?: "customer" | "appointment" | "service_order" | "charge" | "system";
  entityId?: string;
  payload?: Record<string, unknown>;
  onSuccess?: AppAction;
  onError?: AppAction;
};

export type AppNavigateAction = AppActionBase & {
  type: "navigate";
  payload: {
    path: string;
  };
};

export type AppMutationAction = AppActionBase & {
  type: "mutation";
  payload: {
    mutationKey: AppActionMutationKey;
    data?: Record<string, unknown>;
  };
};

export type AppExternalAction = AppActionBase & {
  type: "external";
  payload: {
    url: string;
    target?: "_blank" | "_self";
  };
};

export type AppCompositeAction = AppActionBase & {
  type: "composite";
  payload: {
    actions: AppAction[];
  };
};

export type AppAction =
  | AppNavigateAction
  | AppMutationAction
  | AppExternalAction
  | AppCompositeAction;

export type AppActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
  actionId: string;
};
