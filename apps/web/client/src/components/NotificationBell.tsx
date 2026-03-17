import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";

export default function NotificationBell() {
  const { isAuthenticated, isInitializing } = useAuth();

  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const canQuery = isAuthenticated && !isInitializing;

  const unreadCountQuery =
    trpc.dashboard.notificationCenter.unreadCount.useQuery(undefined, {
      enabled: canQuery,
      refetchInterval: canQuery ? 30000 : false,
      retry: false,
      refetchOnWindowFocus: false,
    });

  const notificationQuery = trpc.dashboard.notificationCenter.list.useQuery(
    { page: 1, limit: 10, category: "all" },
    {
      enabled: canQuery && open,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  useEffect(() => {
    if (!canQuery) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const invalidate = () => {
      void Promise.all([
        utils.dashboard.notificationCenter.unreadCount.invalidate(),
        utils.dashboard.notificationCenter.list.invalidate(),
      ]);
    };

    const connect = () => {
      if (isUnmounted) return;

      eventSource = new EventSource("/api/notification-center/stream", {
        withCredentials: true,
      });

      eventSource.addEventListener("message", invalidate);

      eventSource.onerror = () => {
        eventSource?.removeEventListener("message", invalidate);
        eventSource?.close();

        if (isUnmounted) return;

        reconnectTimer = setTimeout(() => {
          connect();
        }, 2000);
      };
    };

    connect();

    return () => {
      isUnmounted = true;

      if (reconnectTimer) clearTimeout(reconnectTimer);

      eventSource?.removeEventListener("message", invalidate);
      eventSource?.close();
    };
  }, [canQuery, utils]);

  const unreadCount =
    typeof unreadCountQuery.data?.unreadCount === "number"
      ? unreadCountQuery.data.unreadCount
      : 0;

  const items = Array.isArray(notificationQuery.data?.items)
    ? notificationQuery.data.items
    : [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2"
      >
        <Bell className="h-5 w-5" />

        {canQuery && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 text-xs text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && canQuery && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg bg-white p-4 shadow-lg">
          {notificationQuery.isLoading && <p>Carregando...</p>}

          {!notificationQuery.isLoading && items.length === 0 && (
            <p>Nenhuma notificação</p>
          )}

          {items.map((n: any) => (
            <div key={n.id} className="mb-2 border-b pb-2">
              <p className="text-sm">{n.title}</p>
              <p className="text-xs text-gray-500">{n.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
