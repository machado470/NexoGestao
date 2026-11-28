import { Link } from "wouter";

import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const accountLinks = [
  { href: "/profile", label: "Meu perfil" },
  { href: "/settings", label: "Configurações da empresa" },
  { href: "/billing", label: "Assinatura e planos" },
] as const;

export function AccountNavigation({
  current,
}: {
  current: (typeof accountLinks)[number]["href"];
}) {
  const { role } = useAuth();
  if (role !== "ADMIN") return null;

  return (
    <nav aria-label="Conta e empresa" className="flex flex-wrap gap-x-4 border-b">
      {accountLinks.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center border-b-2 px-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
            current === href
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
