import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Instagram, Linkedin, Menu, Twitter, X } from "lucide-react";
import { BrandSignature } from "@/components/BrandSignature";

type MarketingLayoutProps = {
  children: ReactNode;
};

const headerLinks = [
  { label: "Home", href: "/" },
  { label: "Produto", href: "/produto" },
  { label: "Funcionalidades", href: "/funcionalidades" },
  { label: "Preços", href: "/precos" },
  { label: "Contato", href: "/contato" },
];

const footerGroups = [
  {
    title: "Navegação",
    links: [
      { label: "Home", href: "/" },
      { label: "Produto", href: "/produto" },
      { label: "Funcionalidades", href: "/funcionalidades" },
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

const institutionalNotes = [
  "CNPJ em processo de formalização comercial nesta fase de lançamento assistido.",
  "Políticas públicas de privacidade e termos atualizadas para referência contratual.",
  "Atendimento comercial e suporte institucional em dias úteis, horário BRT.",
];

export function MarketingLayout({ children }: MarketingLayoutProps) {
  const [location, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuButton = useRef<HTMLButtonElement>(null);
  const year = useMemo(() => new Date().getFullYear(), []);

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info("[LAYOUT] MarketingLayout mounted", {
      at: new Date().toISOString(),
      pathname: location,
      hasChildren: Boolean(children),
    });
  }

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="nexo-public landing-root min-h-screen">
      <a
        href="#public-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-slate-900 focus:outline-2 focus:outline-orange-700"
      >
        Pular para o conteúdo
      </a>
      <header
        className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[#f8f9fb]/95 backdrop-blur-sm"
        onKeyDown={event => {
          if (event.key !== "Escape" || !mobileMenuOpen) return;
          closeMobileMenu();
          mobileMenuButton.current?.focus();
        }}
      >
        <div className="container flex h-16 items-center justify-between gap-4 lg:h-20">
          <button
            type="button"
            onClick={() => {
              navigate("/");
              closeMobileMenu();
            }}
            className="flex items-center gap-3"
            aria-label="Ir para página inicial"
          >
            <BrandSignature
              className="[&>div:nth-child(2)>p:first-child]:text-slate-900 [&>div:nth-child(2)>p:last-child]:hidden"
              subtitle=""
            />
          </button>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Menu principal">
            {headerLinks.map(item => (
              <Link
                key={item.label}
                href={item.href}
                aria-current={location === item.href ? "page" : undefined}
                className={`rounded-md px-2 py-2 text-sm font-medium transition-colors hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 ${location === item.href ? "bg-slate-200/65 text-slate-900" : "text-slate-600"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              Entrar
            </Link>
            <Link href="/register" className="rounded-xl bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700">
              Começar agora
            </Link>
          </div>

          <button
            type="button"
            ref={mobileMenuButton}
            className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 lg:hidden"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="public-mobile-menu"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        <div
          id="public-mobile-menu"
          hidden={!mobileMenuOpen}
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-slate-200 bg-white lg:hidden"
        >
          <nav className="container flex flex-col gap-1 py-3" aria-label="Menu mobile">
            {headerLinks.map(item => (
              <Link
                key={item.label}
                href={item.href}
                onClick={closeMobileMenu}
                aria-current={location === item.href ? "page" : undefined}
                className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 aria-[current=page]:bg-slate-100 aria-[current=page]:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={closeMobileMenu}
              className="mt-2 flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              onClick={closeMobileMenu}
              className="flex min-h-11 items-center justify-center rounded-lg bg-orange-700 px-3 text-sm font-semibold text-white hover:bg-orange-800"
            >
              Começar agora
            </Link>
          </nav>
        </div>
      </header>

      <main id="public-main" tabIndex={-1} className="scroll-mt-20 lg:scroll-mt-24">
        {children}
      </main>

      <footer className="bg-white py-12">
        <div className="container">
          <div className="grid gap-8 border-b border-slate-200 pb-8 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
            <div className="space-y-4">
              <p className="text-lg font-semibold text-slate-900">NexoGestão</p>
              <p className="text-sm text-slate-600">Plataforma operacional para empresas de serviço com foco em execução, rastreabilidade e governança.</p>
              <ul className="space-y-2 text-xs text-slate-500">
                {institutionalNotes.map(note => (
                  <li key={note}>• {note}</li>
                ))}
              </ul>
            </div>

            {footerGroups.map(group => (
              <div key={group.title}>
                <p className="font-semibold text-slate-900">{group.title}</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {group.links.map(link => (
                    <li key={link.label}>
                      <Link href={link.href} className="transition hover:text-slate-900">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col items-center justify-between gap-3 text-sm text-slate-500 sm:flex-row">
            <p>© {year} NexoGestão. Todos os direitos reservados.</p>
            <div className="flex items-center gap-3">
              <a href="https://x.com" className="rounded-md p-1 transition hover:bg-slate-100" aria-label="Twitter" target="_blank" rel="noreferrer">
                <Twitter className="size-4" />
              </a>
              <a href="https://instagram.com" className="rounded-md p-1 transition hover:bg-slate-100" aria-label="Instagram" target="_blank" rel="noreferrer">
                <Instagram className="size-4" />
              </a>
              <a href="https://linkedin.com" className="rounded-md p-1 transition hover:bg-slate-100" aria-label="LinkedIn" target="_blank" rel="noreferrer">
                <Linkedin className="size-4" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
