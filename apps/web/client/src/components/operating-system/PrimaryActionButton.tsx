import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";

export function PrimaryActionButton({
  label,
  onClick,
  loadingLabel = "Executando...",
  successLabel = "Concluído",
}: {
  label: string;
  onClick: () => void;
  loadingLabel?: string;
  successLabel?: string;
}) {
  return (
    <ActionFeedbackButton
      state="idle"
      idleLabel={label}
      loadingLabel={loadingLabel}
      successLabel={successLabel}
      onClick={onClick}
    />
  );
}
