import { useNotificationStore, getIcon, getColor } from '@/stores/notificationStore';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotificationCenter() {
  const notifications = useNotificationStore((state) => state.notifications);
  const remove = useNotificationStore((state) => state.remove);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification) => {
        const Icon = getIcon(notification.type);
        const colorClass = getColor(notification.type);

        return (
          <div
            key={notification.id}
            className={`flex items-start gap-3 p-4 rounded-lg border ${colorClass} animate-in fade-in slide-in-from-top-2 duration-300`}
          >
            <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">{notification.title}</h3>
              {notification.description && (
                <p className="text-sm opacity-90 mt-1">{notification.description}</p>
              )}
              {notification.action && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-auto p-0 text-xs"
                  onClick={() => {
                    notification.action?.onClick();
                    remove(notification.id);
                  }}
                >
                  {notification.action.label}
                </Button>
              )}
            </div>

            <button
              onClick={() => remove(notification.id)}
              className="flex-shrink-0 p-1 hover:bg-black/10 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
