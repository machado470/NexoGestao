/**
 * MainLayout Moderno - Design Mobile-First
 * Bottom navigation, cards fluidos, spacing moderno, animações suaves
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import {
  Menu,
  X,
  LogOut,
  Moon,
  Sun,
  Users,
  Calendar,
  Briefcase,
  DollarSign,
  BarChart3,
  Shield,
  Settings,
  MessageCircle,
  FileText,
  TrendingDown,
  Home,
  Search,
  Bell,
} from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayoutModern({ children }: MainLayoutProps) {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Menu items para bottom navigation (mobile) e sidebar (desktop)
  const mainMenuItems = [
    { id: "overview", label: "Início", icon: Home, route: "/executive-dashboard" },
    { id: "customers", label: "Clientes", icon: Users, route: "/customers" },
    { id: "appointments", label: "Agendamentos", icon: Calendar, route: "/appointments" },
    { id: "service-orders", label: "Ordens", icon: Briefcase, route: "/service-orders" },
    { id: "finance", label: "Financeiro", icon: DollarSign, route: "/finances" },
  ];

  const secondaryMenuItems = [
    { id: "invoices", label: "Notas Fiscais", icon: FileText, route: "/invoices" },
    { id: "expenses", label: "Despesas", icon: TrendingDown, route: "/expenses" },
    { id: "launches", label: "Lançamentos", icon: TrendingDown, route: "/launches" },
    { id: "referrals", label: "Referências", icon: Users, route: "/referrals" },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, route: "/whatsapp" },
    { id: "whatsapp-automations", label: "Automações WhatsApp", icon: MessageCircle, route: "/whatsapp/automations" },
    { id: "reports", label: "Relatórios", icon: BarChart3, route: "/reports" },
    { id: "people", label: "Pessoas", icon: Users, route: "/people" },
    { id: "governance", label: "Governança", icon: Shield, route: "/governance" },
  ];

  const handleNavigate = (route: string) => {
    navigate(route);
    setSidebarOpen(false);
  };

  return (
    <div className={`flex flex-col h-screen bg-white dark:bg-gray-900 ${theme === "dark" ? "dark" : ""}`}>
      {/* HEADER - Mobile & Desktop */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm animate-slideInUp">
        <div className="flex items-center justify-between h-16 px-4 md:px-6">
          {/* Logo - Desktop only */}
          <div className="hidden md:flex items-center">
            <span className="text-xl font-bold tracking-tight">
              <span className="text-orange-500">Nexo</span>
              <span className="text-gray-900 dark:text-white">Gestão</span>
            </span>
          </div>

          {/* Mobile Logo */}
          <div className="md:hidden flex items-center">
            <span className="text-lg font-bold tracking-tight">
              <span className="text-orange-500">Nexo</span>
              <span className="text-gray-900 dark:text-white">Gestão</span>
            </span>
          </div>

          {/* Center - Search (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar clientes, agendamentos..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Notification Bell */}
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors relative">
              <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-gray-600" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600" />
              )}
            </button>

            {/* User Menu - Desktop */}
            <div className="hidden md:flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-700 relative">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
              </div>
              <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} className="relative">
                <Avatar className="w-9 h-9 cursor-pointer hover:shadow-lg transition-shadow">
                  {user?.profilePicture && (
                    <AvatarImage src={user.profilePicture} alt={user?.name || "User"} />
                  )}
                  <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold text-sm">
                    {user?.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
              </button>
              {profileMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-t border-gray-200 dark:border-gray-700"
                  >
                    <LogOut className="w-4 h-4 inline mr-2" />
                    Sair
                  </button>
                </div>
              )}
            </div>

            {/* Menu Button - Mobile */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {sidebarOpen ? (
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </header>

        {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR - Desktop only */}
        <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 animate-slideInLeft">
          {/* Scrollable Menu Container */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
            {/* Primary Menu */}
            <nav className="px-4 py-6 space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 mb-4">
                Menu Principal
              </p>
              {mainMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.route)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-800 transition-colors group"
                >
                  <item.icon className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Secondary Menu */}
            <nav className="px-4 py-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 mb-4">
                Mais
              </p>
              {secondaryMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.route)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-800 transition-colors group"
                >
                  <item.icon className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

            {/* Settings & Logout - Fixed at bottom */}
          <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800 space-y-2 bg-white dark:bg-gray-900">
            <button onClick={() => handleNavigate('/settings')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-800 transition-colors group">
              <Settings className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
              <span className="text-sm font-medium">Configurações</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group animate-pulse"
              style={{animationDuration: '2s'}}
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">Sair</span>
            </button>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <div
          className={`fixed left-0 top-16 bottom-20 w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 overflow-y-auto z-40 transition-transform duration-300 md:hidden ${
            sidebarOpen ? "translate-x-0 animate-slideInLeft" : "-translate-x-full"
          }`}
        >
          <nav className="px-4 py-6 space-y-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 mb-4">
              Menu Principal
            </p>
            {mainMenuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.route)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-800 transition-colors group"
              >
                <item.icon className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          <nav className="px-4 py-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 mb-4">
              Mais
            </p>
            {secondaryMenuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.route)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-800 transition-colors group"
              >
                <item.icon className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">Sair</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0 bg-gray-50 dark:bg-gray-900 animate-fadeIn">
          <div className="max-w-7xl mx-auto p-4 md:p-6 page-transition">
            {children}
          </div>
        </main>


      </div>

      {/* BOTTOM NAVIGATION - Mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 z-40 animate-slideInUp">
        <div className="flex items-center justify-around h-20">
            {mainMenuItems.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.route)}
                className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-gray-600 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors group hover-lift"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <item.icon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            ))}
        </div>
      </nav>
    </div>
  );
}
