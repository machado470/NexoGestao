import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CreditCard } from "lucide-react";

export default function FinancesPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  // Queries
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
  const pagination = chargesQuery.data?.pagination || { page: 1, limit: 20, total: 0, pages: 1 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CreditCard className="w-8 h-8 text-orange-500" />
          Financeiro
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Gestao de cobrancas e receitas</p>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total de Cobrancas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalCharges}
              </div>
              <p className="text-xs text-gray-500 mt-1">Todas as cobrancas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cobrancas Pagas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {Number(stats.totalPaidAmount || 0).toFixed(2)}
              </div>
              <p className="text-xs text-gray-500 mt-1">{stats.totalPaid} cobrancas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cobrancas Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                R$ {Number(stats.totalPendingAmount || 0).toFixed(2)}
              </div>
              <p className="text-xs text-gray-500 mt-1">{stats.totalPending} cobrancas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cobrancas Vencidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                R$ {Number(stats.totalOverdueAmount || 0).toFixed(2)}
              </div>
              <p className="text-xs text-gray-500 mt-1">{stats.totalOverdue} cobrancas</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Overdue Alert */}
      {stats && stats.totalOverdue > 0 && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <CardTitle className="text-red-900 dark:text-red-400">
                {stats.totalOverdue} Cobrancas Vencidas
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

      {/* Charges List */}
      <Card>
        <CardHeader>
          <CardTitle>Cobrancas</CardTitle>
          <CardDescription>
            Pagina {pagination.page} de {pagination.pages}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {charges && charges.length > 0 ? (
            <div className="space-y-4">
              {charges.map((charge: any) => (
                <div
                  key={charge.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {charge.description || `Cobranca #${charge.id}`}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Cliente: {charge.customerName || "N/A"}
                      </p>
                    </div>
                    <Badge className={getStatusColor(charge.status)}>
                      {getStatusLabel(charge.status)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Valor</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        R$ {Number(charge.amount || 0).toFixed(2)}
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
                    {charge.paidDate && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Pagamento</p>
                        <p className="font-semibold text-green-600">
                          {new Date(charge.paidDate).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Metodo</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {charge.paymentMethod || "N/A"}
                      </p>
                    </div>
                  </div>

                  {charge.notes && (
                    <div className="mt-3 p-2 bg-gray-100 dark:bg-gray-700/50 rounded text-sm text-gray-700 dark:text-gray-300">
                      {charge.notes}
                    </div>
                  )}
                </div>
              ))}

              {/* Pagination */}
              <div className="flex justify-between items-center mt-6 pt-4 border-t">
                <Button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  variant="outline"
                >
                  Anterior
                </Button>
                <span className="text-sm text-gray-600">
                  Pagina {pagination.page} de {pagination.pages}
                </span>
                <Button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pagination.pages}
                  variant="outline"
                >
                  Proxima
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Nenhuma cobranca encontrada
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
