import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";

export function PrimaryActionButton({
  label,
  onClick,
  loadingLabel = "Executando...",
  successLabel = "Concluído",
  className,
  disabled,
}: {
  label: string;
  onClick: () => void;
  loadingLabel?: string;
  successLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <ActionFeedbackButton
      state="idle"
      idleLabel={label}
      loadingLabel={loadingLabel}
      successLabel={successLabel}
      onClick={onClick}
      className={className}
      disabled={disabled}
    />
  );
}
