import { Button } from "@/components/ui/button";
import { useNotificationStore, getIcon, getColor } from "@/stores/notificationStore";
import { X } from "lucide-react";


export function NotificationCenter({ inline = false, onAction }: { inline?: boolean; onAction?: () => void }) {
  const notifications = useNotificationStore(state => state.notifications);
  const remove = useNotificationStore(state => state.remove);

  return (
    <div className={inline ? "space-y-2 p-2" : "fixed right-4 top-4 z-50 hidden max-w-md space-y-2 md:block"}>
      {inline && notifications.length > 0 ? <p className="text-xs font-medium text-[var(--text-muted)]">Avisos desta sessão</p> : null}
      {notifications.map(notification => {
        const Icon = getIcon(notification.type);
        const colorClass = getColor(notification.type);

        return (
          <div
            key={notification.id}
            data-state="open"
            className={`nexo-floating-panel nexo-motion-panel nexo-state-transition flex items-start gap-3 rounded-[var(--radius-surface)] border p-4 ${colorClass}`}
          >
            <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />

            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">{notification.title}</h3>
              {notification.description && (
                <p className="mt-1 text-sm opacity-90">{notification.description}</p>
              )}
              {notification.action && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={inline ? "mt-2 min-h-11 whitespace-normal px-0 text-sm text-[var(--accent)]" : "mt-2 h-auto p-0 text-xs text-[var(--accent)]"}
                  onClick={() => {
                    notification.action?.onClick();
                    remove(notification.id);
                    onAction?.();
                  }}
                >
                  {notification.action.label}
                </Button>
              )}
            </div>

            <button
              aria-label={`Dispensar aviso: ${notification.title}`}
              onClick={() => remove(notification.id)}
              className={inline ? "flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded hover:bg-[var(--accent-soft)]" : "flex-shrink-0 rounded p-1 nexo-state-transition hover:bg-[var(--accent-soft)]"}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
