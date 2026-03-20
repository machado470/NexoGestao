import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  Loader2,
  Sparkles,
  AlertTriangle,
  Info,
  CheckCircle2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

function getNotificationTone(item: any) {
  const severity = String(
    item?.severity || item?.level || item?.type || ""
  ).toLowerCase();

  if (
    severity.includes("critical") ||
    severity.includes("high") ||
    severity.includes("error")
  ) {
    return {
      icon: AlertTriangle,
      iconClass:
        "text-red-600 dark:text-red-300",
      badgeClass:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
    };
  }

  if (
    severity.includes("success") ||
    severity.includes("done") ||
    severity.includes("resolved")
  ) {
    return {
      icon: CheckCircle2,
      iconClass:
        "text-green-600 dark:text-green-300",
      badgeClass:
        "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300",
    };
  }

  return {
    icon: Info,
    iconClass:
      "text-orange-600 dark:text-orange-300",
    badgeClass:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300",
  };
}

function formatRelativeDate(value?: string | null) {
  if (!value) return "Agora há pouco";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora há pouco";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Agora há pouco";
  if (diffMinutes < 60) return `Há ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Há ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Há ${diffDays} d`;

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default function NotificationBell() {
  const { isAuthenticated, isInitializing } = useAuth();

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const unreadCount =
    typeof unreadCountQuery.data?.unreadCount === "number"
      ? unreadCountQuery.data.unreadCount
      : 0;

  const items = Array.isArray(notificationQuery.data?.items)
    ? notificationQuery.data.items
    : [];

  const headerLabel = useMemo(() => {
    if (!canQuery) return "Notificações indisponíveis";
    if (unreadCount <= 0) return "Tudo sob controle";
    if (unreadCount === 1) return "1 item pedindo atenção";
    return `${unreadCount} itens pedindo atenção`;
  }, [canQuery, unreadCount]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`relative flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors ${
          open
            ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300"
            : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
        }`}
        aria-label="Abrir notificações"
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5" />
        ) : (
          <Bell className="h-5 w-5" />
        )}

        {canQuery && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && canQuery && (
        <div className="absolute right-0 z-50 mt-3 w-[360px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#111113]">
          <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                  <Sparkles className="h-4 w-4 text-orange-500" />
                  Central de notificações
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {headerLabel}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void unreadCountQuery.refetch();
                  void notificationQuery.refetch();
                }}
              >
                Atualizar
              </Button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notificationQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-zinc-500 dark:text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando notificações...
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                  <Bell className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                </div>
                <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-white">
                  Nenhuma notificação agora
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Quando algo relevante acontecer, aparece aqui.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {items.map((item: any) => {
                  const tone = getNotificationTone(item);
                  const ToneIcon = tone.icon;

                  return (
                    <div
                      key={item.id}
                      className="px-4 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                          <ToneIcon className={`h-4 w-4 ${tone.iconClass}`} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-zinc-900 dark:text-white">
                              {item.title || "Notificação"}
                            </p>

                            {item.severity || item.level || item.type ? (
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.badgeClass}`}
                              >
                                {String(item.severity || item.level || item.type)}
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                            {item.message || "Sem detalhes adicionais."}
                          </p>

                          <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                            {formatRelativeDate(item.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
