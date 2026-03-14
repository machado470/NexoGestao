import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";

export default function FinancesPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const chargesQuery = trpc.finance.charges.list.useQuery({ page, limit });
  const statsQuery = trpc.finance.charges.stats.useQuery({});

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PAID":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "OVERDUE":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "CANCELED":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PAID":
        return "Pago";
      case "PENDING":
        return "Pendente";
      case "OVERDUE":
        return "Vencido";
      case "CANCELED":
        return "Cancelado";
      default:
        return status;
    }
  };

  if (chargesQuery.isLoading || statsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const stats = statsQuery.data;
  const charges = chargesQuery.data?.data || [];
  const pagination = chargesQuery.data?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Financeiro</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Gestão de cobranças e receitas
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Cobranças
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalCharges}
              </div>
              <p className="mt-1 text-xs text-gray-500">Todas as cobranças</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Cobranças Pagas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {Number(stats.totalPaidAmount || 0).toFixed(2)}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {stats.totalPaid} cobranças
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Cobranças Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                R$ {Number(stats.totalPendingAmount || 0).toFixed(2)}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {stats.totalPending} cobranças
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Cobranças Vencidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                R$ {Number(stats.totalOverdueAmount || 0).toFixed(2)}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {stats.totalOverdue} cobranças
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {stats && stats.totalOverdue > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-900 dark:text-red-400">
                {stats.totalOverdue} Cobranças Vencidas
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-800 dark:text-red-300">
              Total em atraso: R$ {Number(stats.totalOverdueAmount || 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cobranças</CardTitle>
          <CardDescription>
            Página {pagination.page} de {pagination.pages}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {charges.length > 0 ? (
            <div className="space-y-4">
              {charges.map((charge: any) => (
                <div
                  key={charge.id}
                  className="rounded-lg border p-4 transition hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {charge.notes || `Cobrança #${charge.id}`}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Cliente: {charge.customer?.name || "N/A"}
                      </p>
                    </div>

                    <Badge className={getStatusColor(charge.status)}>
                      {getStatusLabel(charge.status)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Valor</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        R$ {(Number(charge.amountCents || 0) / 100).toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Vencimento</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {charge.dueDate
                          ? new Date(charge.dueDate).toLocaleDateString("pt-BR")
                          : "N/A"}
                      </p>
                    </div>

                    {charge.paidAt && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Pagamento</p>
                        <p className="font-semibold text-green-600">
                          {new Date(charge.paidAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <Button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  variant="outline"
                >
                  Anterior
                </Button>

                <span className="text-sm text-gray-600">
                  Página {pagination.page} de {pagination.pages}
                </span>

                <Button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pagination.pages}
                  variant="outline"
                >
                  Próxima
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              Nenhuma cobrança encontrada
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
