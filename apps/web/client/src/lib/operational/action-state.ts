export type OperationalActionState = "idle" | "loading" | "success" | "error";

export const operationalActionLabels: Record<OperationalActionState, string> = {
  idle: "Pronto para executar",
  loading: "Executando ação...",
  success: "Ação concluída com sucesso",
  error: "Falha ao executar ação",
};
