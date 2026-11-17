import type { ComponentType } from "react";
import { House, Menu } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GlobalSearch } from "@/components/GlobalSearch";

type Item = {
  id: string;
  label: string;
  route: string;
  icon: ComponentType<{ className?: string }>;
};
type Section = { id: string; label: string; items: Item[] };
export function MobileAppNavigation({
  sections,
  location,
  financeAllowed,
  onNavigate,
  menuOpen,
  onMenuChange,
  searchOpen,
  onSearchChange,
  theme,
  onThemeToggle,
}: {
  sections: Section[];
  location: string;
  financeAllowed: boolean;
  onNavigate: (route: string) => void;
  menuOpen: boolean;
  onMenuChange: (open: boolean) => void;
  searchOpen: boolean;
  onSearchChange: (open: boolean) => void;
  theme: string;
  onThemeToggle: () => void;
}) {
  const ids = [
    "dashboard",
    "appointments",
    "customers",
    financeAllowed ? "finances" : "service-orders",
  ];
  const tabs = ids.flatMap(id =>
    sections.flatMap(section => section.items).filter(item => item.id === id)
  );
  const active = (item: Item) =>
    location === item.route ||
    location.startsWith(item.route + "/") ||
    (item.id === "appointments" && location === "/calendar");
  const moreActive = !tabs.some(active);
  return (
    <>
      <nav
        aria-label="Navegação principal no celular"
        className="mobile-app-nav"
      >
        {tabs.map(item => {
          const Icon = item.id === "dashboard" ? House : item.icon;
          const label =
            item.id === "dashboard"
              ? "Início"
              : item.id === "appointments"
                ? "Agenda"
                : item.id === "service-orders"
                  ? "O.S."
                  : item.label;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.route)}
              aria-current={active(item) ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </button>
          );
        })}
        <button
          type="button"
          aria-current={moreActive ? "page" : undefined}
          onClick={() => onMenuChange(true)}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
        >
          <Menu className="h-5 w-5" />
          <span>Mais</span>
        </button>
      </nav>
      <Dialog open={menuOpen} onOpenChange={onMenuChange}>
        <DialogContent className="max-h-[80dvh] overflow-y-auto bg-[var(--surface-primary)] text-[var(--text-primary)]">
          <DialogHeader>
            <DialogTitle>Mais opções</DialogTitle>
          </DialogHeader>
          <nav aria-label="Todas as áreas" className="space-y-4">
            {sections.map(section => (
              <section key={section.id}>
                <h2 className="mb-1 text-xs font-semibold text-[var(--text-muted)]">
                  {section.label}
                </h2>
                <div className="grid grid-cols-2 gap-1">
                  {section.items.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-[var(--accent-soft)]"
                      onClick={() => onNavigate(item.route)}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="break-words">{item.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </nav>
          <button
            type="button"
            className="min-h-11 text-left text-sm"
            onClick={onThemeToggle}
          >
            {theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={searchOpen} onOpenChange={onSearchChange}>
        <DialogContent className="top-[15%] translate-y-0 overflow-visible bg-[var(--surface-primary)] text-[var(--text-primary)]">
          <DialogHeader>
            <DialogTitle>Buscar</DialogTitle>
          </DialogHeader>
          <GlobalSearch compact onNavigate={() => onSearchChange(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
