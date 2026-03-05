import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Breadcrumbs } from "./Breadcrumbs";
import { GlobalSearch } from "./GlobalSearch";
import NotificationBell from "./NotificationBell";

import {
  Menu,
  X,
  LogOut,
  Moon,
  Sun,
  Users,
  Calendar,
  CalendarDays,
  Briefcase,
  DollarSign,
  BarChart3,
  Shield,
  ChevronRight,
  MessageCircle,
  FileText,
  TrendingDown,
  ChevronLeft,
  Settings
} from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {

  const [, navigate] = useLocation()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {

    const update = () => {
      setIsMobile(window.innerWidth < 768)
    }

    update()

    window.addEventListener("resize", update)

    return () => {
      window.removeEventListener("resize", update)
    }

  }, [])

  const handleLogout = () => {

    logout()

    navigate("/")

  }

  const menuItems = [

    { id: "overview", label: "Visão Geral", icon: BarChart3, route: "/executive-dashboard" },

    { id: "customers", label: "Clientes", icon: Users, route: "/customers" },

    { id: "appointments", label: "Agendamentos", icon: Calendar, route: "/appointments" },

    { id: "service-orders", label: "Ordens de Serviço", icon: Briefcase, route: "/service-orders" },

    { id: "finance", label: "Financeiro", icon: DollarSign, route: "/finances" },

    { id: "invoices", label: "Notas Fiscais", icon: FileText, route: "/invoices" },

    { id: "expenses", label: "Despesas", icon: TrendingDown, route: "/expenses" },

    { id: "launches", label: "Lançamentos", icon: TrendingDown, route: "/launches" },

    { id: "referrals", label: "Referências", icon: Users, route: "/referrals" },

    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, route: "/whatsapp" },

    { id: "people", label: "Pessoas", icon: Users, route: "/people" },

    { id: "governance", label: "Governança", icon: Shield, route: "/governance" },

    { id: "calendar", label: "Calendário", icon: CalendarDays, route: "/calendar" },

    { id: "timeline", label: "Timeline", icon: BarChart3, route: "/timeline" },

    { id: "settings", label: "Configurações", icon: Settings, route: "/settings" }

  ] as const

  const handleNavigate = (route: string) => {

    navigate(route)

    if (isMobile) {
      setSidebarOpen(false)
    }

  }

  return (

    <div className={`flex h-screen bg-gray-50 dark:bg-gray-900 ${theme === "dark" ? "dark" : ""}`}>

      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed md:relative left-0 top-0 h-screen z-40 bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${sidebarCollapsed ? "md:w-20" : "w-64 md:w-64"}`}
      >

        <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 min-h-16">

          <div className={`flex items-center ${sidebarCollapsed ? "justify-center w-full" : ""}`}>

            <div className="h-10 w-10 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
              N
            </div>

            {!sidebarCollapsed && (
              <span className="ml-3 text-lg font-bold text-gray-900 dark:text-white whitespace-nowrap">
                NexoGestão
              </span>
            )}

          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">

          {menuItems.map((item) => {

            const Icon = item.icon

            return (

              <button
                key={item.id}
                onClick={() => handleNavigate(item.route)}
                className={`w-full flex items-center rounded-lg transition-colors text-gray-600 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 dark:hover:text-orange-400 group ${
                  sidebarCollapsed ? "justify-center p-2" : "px-3 py-2"
                }`}
                title={item.label}
              >

                <Icon className="w-5 h-5 flex-shrink-0" />

                {!sidebarCollapsed && (
                  <>
                    <span className="ml-3 text-sm font-medium flex-1 text-left">{item.label}</span>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </>
                )}

              </button>

            )

          })}

        </nav>

        <div className="border-t border-gray-200 dark:border-gray-700 p-2 space-y-1">

          <button
            onClick={toggleTheme}
            className={`w-full flex items-center rounded-lg transition-colors text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
              sidebarCollapsed ? "justify-center p-2" : "px-3 py-2"
            }`}
          >

            {theme === "dark"
              ? <Sun className="w-5 h-5 flex-shrink-0" />
              : <Moon className="w-5 h-5 flex-shrink-0" />
            }

            {!sidebarCollapsed && (
              <span className="ml-3 text-sm font-medium">
                {theme === "dark" ? "Claro" : "Escuro"}
              </span>
            )}

          </button>

          <button
            onClick={handleLogout}
            className={`w-full flex items-center rounded-lg transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 ${
              sidebarCollapsed ? "justify-center p-2" : "px-3 py-2"
            }`}
          >

            <LogOut className="w-5 h-5 flex-shrink-0" />

            {!sidebarCollapsed && (
              <span className="ml-3 text-sm font-medium">Sair</span>
            )}

          </button>

        </div>

      </aside>

      <div className="flex-1 flex flex-col w-full overflow-hidden">

        <header className="h-16 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 md:px-6 sticky top-0 z-20 flex-shrink-0">

          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">

            <button
              onClick={() => {

                if (isMobile) {
                  setSidebarOpen(!sidebarOpen)
                } else {
                  setSidebarCollapsed(!sidebarCollapsed)
                }

              }}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            >

              {isMobile
                ? <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                : sidebarCollapsed
                  ? <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  : <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              }

            </button>

            <div className="hidden md:block min-w-0">
              <Breadcrumbs />
            </div>

          </div>

          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">

            <div className="hidden lg:block w-48 xl:w-64">
              <GlobalSearch />
            </div>

            <NotificationBell />

            <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400 hidden sm:block truncate max-w-[150px]">
              {user?.email || "Usuário"}
            </span>

            <div className="h-8 w-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>

          </div>

        </header>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-6 p-3 md:p-8">

          <main className="flex-1 min-w-0 overflow-y-auto">

            <div className="max-w-7xl mx-auto w-full px-3 md:px-4">
              {children}
            </div>

          </main>

        </div>

      </div>

    </div>

  )
}
