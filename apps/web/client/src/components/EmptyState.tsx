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
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4 text-gray-400 dark:text-gray-500">
        {icon}
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>

      <p className="text-gray-600 dark:text-gray-400 max-w-sm mb-6">{description}</p>

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
