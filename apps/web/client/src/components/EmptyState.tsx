import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="nexo-surface-operational flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-100 text-slate-500 dark:border-white/12 dark:bg-white/[0.04] dark:text-slate-300">
        {icon}
      </div>

      <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">{title}</h3>

      <p className="mb-6 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">{description}</p>

      <div className="flex gap-3">
        {action && (
          <Button onClick={action.onClick} size="sm">
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button onClick={secondaryAction.onClick} variant="outline" size="sm">
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}
