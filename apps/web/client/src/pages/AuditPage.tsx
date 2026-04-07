import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  RefreshCw,
  Search,
  Filter,
  BarChart3,
  Clock,
  User,
  FileText,
  Loader2,
} from "lucide-react";

type AuditEvent = {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  description?: string | null;
  createdAt: string;
  actorName?: string;
  metadata?: Record<string, any> | null;
};

export default function AuditPage() {
  const { isAuthenticated, isInitializing, user } = useAuth();
  const canQuery = isAuthenticated && !isInitializing && user?.role === "ADMIN";

  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const eventsQuery = trpc.audit.listEvents.useQuery(
    { page, limit: 50, action: action || undefined },
    { enabled: canQuery, retry: false }
  );

  const summaryQuery = trpc.audit.getSummary.useQuery(
    {},
    { enabled: canQuery, retry: false }
  );

  const events = useMemo<AuditEvent[]>(() => {
    const payload = eventsQuery.data;
    const rows = Array.isArray((payload as any)?.data)
      ? (payload as any).data
      : Array.isArray(payload)
        ? payload
        : [];

    return rows.filter((event: any) => {
      if (!search) return true;
      const term = search.toLowerCase();
      return (
        String(event.action).toLowerCase().includes(term) ||
        String(event.description ?? "")
          .toLowerCase()
          .includes(term) ||
        String(event.actorName ?? "")
          .toLowerCase()
          .includes(term)
      );
    }) as AuditEvent[];
  }, [eventsQuery.data, search]);

  const summary = useMemo(() => {
    const payload = summaryQuery.data;
    return {
      total: Number((payload as any)?.total ?? 0),
      byAction: Array.isArray((payload as any)?.byAction)
        ? (payload as any).byAction
        : [],
      byActor: Array.isArray((payload as any)?.byActor)
        ? (payload as any).byActor
        : [],
    };
  }, [summaryQuery.data]);

  const topActions = useMemo(() => {
    return summary.byAction.slice(0, 5);
  }, [summary.byAction]);

  if (isInitializing) {
    return (
      <div className="nexo-surface flex min-h-[180px] items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
        Carregando auditoria...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="nexo-surface min-h-[180px] p-6 text-sm text-zinc-500 dark:text-zinc-400">
        Faça login para acessar a auditoria.
      </div>
    );
  }

  if (user?.role !== "ADMIN") {
    return (
      <div className="nexo-surface min-h-[180px] p-6 text-sm text-zinc-500 dark:text-zinc-400">
        Acesso restrito a administradores.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-200/80 bg-purple-100/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-purple-700 dark:border-purple-500/20 dark:bg-purple-500/12 dark:text-purple-300">
            <BarChart3 className="h-3.5 w-3.5" />
            Auditoria Administrativa
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            Histórico de Operações
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Quem fez o quê, quando e por quê. Rastreamento completo de todas as
            operações do sistema.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => void summaryQuery.refetch()}
          disabled={summaryQuery.isFetching}
          className="h-10 rounded-xl border-slate-200/80 bg-white/80 px-4 dark:border-white/10 dark:bg-white/[0.03]"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Total de Eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-950 dark:text-white">
              {summary.total}
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Registros auditados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Ações Únicas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-950 dark:text-white">
              {summary.byAction.length}
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Tipos de operação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Atores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-950 dark:text-white">
              {summary.byActor.length}
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Usuários ativos
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-500" />
              Eventos Recentes
            </CardTitle>
            <CardDescription>
              Últimas operações registradas no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Buscar por ação, descrição ou usuário..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-3 py-2 text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-400"
                  />
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                </Button>
              </div>

              {eventsQuery.isLoading ? (
                <div className="text-center text-sm text-zinc-500">
                  Carregando eventos...
                </div>
              ) : events.length === 0 ? (
                <div className="text-center text-sm text-zinc-500">
                  Nenhum evento encontrado.
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map(event => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-900 dark:text-white">
                            {event.action}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {new Date(event.createdAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        {event.description && (
                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                            {event.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {event.actorName && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                              <User className="h-3 w-3" />
                              {event.actorName}
                            </span>
                          )}
                          {event.entityType && (
                            <span className="inline-flex rounded-full bg-white px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                              {event.entityType}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ações Mais Frequentes</CardTitle>
            <CardDescription>Top 5 operações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topActions.length === 0 ? (
                <div className="text-sm text-zinc-500">
                  Nenhuma ação registrada.
                </div>
              ) : (
                topActions.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {item.action}
                    </span>
                    <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      {item.count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
