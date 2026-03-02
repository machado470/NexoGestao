import { useState, useEffect } from "react";
import { Bell, AlertCircle, Clock, DollarSign } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Notification {
  id: string;
  type: "overdue" | "upcoming" | "warning";
  title: string;
  message: string;
  icon: React.ReactNode;
  timestamp: Date;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const chargesQuery = trpc.finance.charges.list.useQuery(undefined, { enabled: false });
  const appointmentsQuery = trpc.data.appointments.list.useQuery(undefined, { enabled: false });
  const governanceQuery = trpc.governance.governance.list.useQuery(undefined, { enabled: false });

  useEffect(() => {
    const loadNotifications = async () => {
      const newNotifications: Notification[] = [];

      // Refetch data
      await Promise.all([
        chargesQuery.refetch(),
        appointmentsQuery.refetch(),
        governanceQuery.refetch(),
      ]);

      // Check for overdue charges
      if (chargesQuery.data) {
      const overdueCharges = (chargesQuery.data || []).filter(
        (charge: any) => charge.status === "OVERDUE"
      );
      if (overdueCharges.length > 0) {
        newNotifications.push({
          id: "overdue-charges",
          type: "overdue",
          title: `${overdueCharges.length} Cobranças Vencidas`,
          message: `Você tem ${overdueCharges.length} cobranças vencidas que precisam de atenção`,
          icon: <DollarSign className="w-5 h-5 text-red-500" />,
          timestamp: new Date(),
        });
      }
    }

    // Check for upcoming appointments
    if (appointmentsQuery.data) {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const upcomingAppointments = (appointmentsQuery.data || []).filter((apt: any) => {
        const aptDate = new Date(apt.startsAt);
        return aptDate > now && aptDate <= tomorrow;
      });
      if (upcomingAppointments.length > 0) {
        newNotifications.push({
          id: "upcoming-appointments",
          type: "upcoming",
          title: `${upcomingAppointments.length} Agendamentos Próximos`,
          message: `Você tem ${upcomingAppointments.length} agendamentos nas próximas 24 horas`,
          icon: <Clock className="w-5 h-5 text-blue-500" />,
          timestamp: new Date(),
        });
      }
    }

    // Check for high-risk governance records
    if (governanceQuery.data) {
      const criticalRisks = (governanceQuery.data || []).filter(
        (record: any) => record.riskLevel === "CRITICAL"
      );
      if (criticalRisks.length > 0) {
        newNotifications.push({
          id: "critical-risks",
          type: "warning",
          title: `${criticalRisks.length} Riscos Críticos Detectados`,
          message: `Existem ${criticalRisks.length} registros com risco crítico que requerem ação imediata`,
          icon: <AlertCircle className="w-5 h-5 text-orange-500" />,
          timestamp: new Date(),
        });
      }
    }

      setNotifications(newNotifications);
    };

    loadNotifications();
  }, []);

  const unreadCount = notifications.length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Notificações"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Notificações</h3>
          </div>

          {notifications.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">{notification.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-white">
                        {notification.title}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        Agora
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma notificação no momento</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
