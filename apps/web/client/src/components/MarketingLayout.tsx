import { useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Instagram, Linkedin, Twitter } from "lucide-react";

type MarketingLayoutProps = {
  children: ReactNode;
};

const headerLinks = [
  { label: "Produto", href: "/produto" },
  { label: "Funcionalidades", href: "/produto#funcionalidades" },
  { label: "Preços", href: "/precos" },
  { label: "Contato", href: "/contato" },
];

const footerGroups = [
  {
    title: "Navegação",
    links: [
      { label: "Produto", href: "/produto" },
      { label: "Preços", href: "/precos" },
      { label: "Entrar", href: "/login" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Sobre", href: "/sobre" },
      { label: "Contato", href: "/contato" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacidade", href: "/privacidade" },
      { label: "Termos", href: "/termos" },
    ],
  },
];

export function MarketingLayout({ children }: MarketingLayoutProps) {
  const [, navigate] = useLocation();
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="landing-root min-h-screen">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-[#f8f9fb]/90 backdrop-blur-xl">
        <div className="container flex h-20 items-center justify-between gap-4">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-content-center rounded-xl bg-slate-900 shadow-sm">
              <div className="grid grid-cols-2 gap-1">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-white" />
                <span className="h-2.5 w-2.5 rounded-[3px] bg-orange-500" />
                <span className="h-2.5 w-2.5 rounded-[3px] bg-blue-500" />
                <span className="h-2.5 w-2.5 rounded-[3px] bg-white" />
              </div>
            </div>
            <span className="text-lg font-semibold text-slate-900">NexoGestão</span>
          </button>

          <nav className="hidden items-center gap-8 md:flex">
            {headerLinks.map((item) => (
              <a key={item.label} href={item.href} className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/login" className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              Entrar
            </a>
            <a href="/register" className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(249,115,22,0.35)] transition hover:bg-orange-600">
              Começar agora
            </a>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="bg-white py-12">
        <div className="container">
          <div className="grid gap-8 border-b border-slate-200 pb-8 md:grid-cols-4">
            <div>
              <p className="text-lg font-semibold text-slate-900">NexoGestão</p>
              <p className="mt-2 text-sm text-slate-600">Plataforma operacional para empresas de serviço.</p>
            </div>

            {footerGroups.map((group) => (
              <div key={group.title}>
                <p className="font-semibold text-slate-900">{group.title}</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} className="transition hover:text-slate-900">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col items-center justify-between gap-3 text-sm text-slate-500 sm:flex-row">
            <p>© {year} NexoGestão. Todos os direitos reservados.</p>
            <div className="flex items-center gap-3">
              <Twitter className="size-4" />
              <Instagram className="size-4" />
              <Linkedin className="size-4" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
