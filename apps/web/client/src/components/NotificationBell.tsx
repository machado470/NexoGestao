import React, { useMemo, useState } from "react";
import { Bell, CheckCheck, CalendarClock, DollarSign, ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pagination } from "@/components/Pagination";

type FilterType = "all" | "appointments" | "finance" | "risk";

const FILTERS: Array<{ value: FilterType; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "appointments", label: "Agendamentos" },
  { value: "finance", label: "Financeiro" },
  { value: "risk", label: "Risco" },
];

function notificationIcon(type: string) {
  if (type.includes("APPOINTMENT") || type.includes("SERVICE_ORDER")) {
    return CalendarClock;
  }

  if (type.includes("PAYMENT")) {
    return DollarSign;
  }

  return ShieldAlert;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [category, setCategory] = useState<FilterType>("all");

  const utils = trpc.useUtils();

  const unreadCountQuery = trpc.dashboard.notificationCenter.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const notificationQuery = trpc.dashboard.notificationCenter.list.useQuery(
    { page, limit, category },
    {
      enabled: open
    }
  );

  const markAsReadMutation = trpc.dashboard.notificationCenter.markAsRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.dashboard.notificationCenter.list.invalidate(),
        utils.dashboard.notificationCenter.unreadCount.invalidate(),
      ]);
    },
  });

  const unreadCount = unreadCountQuery.data?.unreadCount ?? 0;
  const payload = notificationQuery.data;

  const hasNotifications = useMemo(() => (payload?.items?.length ?? 0) > 0, [payload]);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative rounded-lg border px-3 py-2 dark:border-zinc-800"
          title="Central de notificações"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
              {unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[420px] p-0">
        <div className="border-b px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Central de Notificações</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Organização: alertas operacionais</p>
            </div>
            <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold dark:bg-zinc-800">
              Não lidas: {payload?.unreadCount ?? unreadCount}
            </span>
          </div>

          <div className="mt-3 flex gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => {
                  setCategory(filter.value);
                  setPage(1);
                }}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  category === filter.value
                    ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200"
                    : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-3">
          {notificationQuery.isLoading ? (
            <div className="rounded-lg border p-3 text-sm text-zinc-500 dark:border-zinc-800">Carregando notificações...</div>
          ) : !hasNotifications ? (
            <div className="rounded-lg border p-3 text-sm text-zinc-500 dark:border-zinc-800">
              Nenhuma notificação encontrada para este filtro.
            </div>
          ) : (
            <div className="space-y-2">
              {payload?.items.map((notification) => {
                const Icon = notificationIcon(notification.type);

                return (
                  <div key={notification.id} className="rounded-lg border p-3 dark:border-zinc-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <Icon className="mt-0.5 h-4 w-4 text-zinc-500" />
                        <div>
                          <div className="text-sm font-semibold">{notification.title}</div>
                          <div className="text-sm text-zinc-600 dark:text-zinc-300">{notification.message}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {new Date(notification.createdAt).toLocaleString("pt-BR")}
                          </div>
                        </div>
                      </div>

                      {!notification.read ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1"
                          title="Marcar como lida"
                          onClick={() => markAsReadMutation.mutate({ id: notification.id })}
                        >
                          <CheckCheck className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Lida
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Pagination
          page={payload?.page ?? page}
          pages={Math.max(1, payload?.pages ?? 1)}
          total={payload?.total ?? 0}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
