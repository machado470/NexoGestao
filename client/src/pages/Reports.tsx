import React, { useState } from "react";
import { BarChart3, Download, Filter, Calendar, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

interface ReportFilter {
  startDate: string;
  endDate: string;
  reportType: "sales" | "customers" | "appointments" | "finances" | "all";
}

export default function Reports() {
  const [filters, setFilters] = useState<ReportFilter>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    reportType: "all",
  });

  const [isExporting, setIsExporting] = useState(false);

  // Mock data for reports
  const reportData = {
    totalCustomers: 291,
    totalAppointments: 97,
    totalOrders: 99,
    totalRevenue: 15420.5,
    customerGrowth: 12,
    appointmentGrowth: 8,
    orderGrowth: 5,
    revenueGrowth: 15,
  };

  const handleExport = async (format: "pdf" | "excel") => {
    setIsExporting(true);
    try {
      // Simular exportação
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log(`Exportando relatório em ${format.toUpperCase()}`);
    } finally {
      setIsExporting(false);
    }
  };

  const reportTypes = [
    { value: "all", label: "Todos os Relatórios" },
    { value: "sales", label: "Vendas" },
    { value: "customers", label: "Clientes" },
    { value: "appointments", label: "Agendamentos" },
    { value: "finances", label: "Financeiro" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-orange-500" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Relatórios
          </h1>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Inicial
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters({ ...filters, startDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Final
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                setFilters({ ...filters, endDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de Relatório
            </label>
            <select
              value={filters.reportType}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  reportType: e.target.value as any,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {reportTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <Button className="flex-1 bg-orange-500 hover:bg-orange-600">
              <Filter className="w-4 h-4 mr-2" />
              Filtrar
            </Button>
          </div>
        </div>
      </Card>

      {/* Export Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => handleExport("pdf")}
          disabled={isExporting}
          variant="outline"
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar PDF
        </Button>
        <Button
          onClick={() => handleExport("excel")}
          disabled={isExporting}
          variant="outline"
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Total de Clientes
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {reportData.totalCustomers}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                +{reportData.customerGrowth}% vs mês anterior
              </p>
            </div>
          </div>
        </Card>

        {/* Total Appointments */}
        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Total de Agendamentos
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {reportData.totalAppointments}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                +{reportData.appointmentGrowth}% vs mês anterior
              </p>
            </div>
          </div>
        </Card>

        {/* Total Orders */}
        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Total de Ordens
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {reportData.totalOrders}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                +{reportData.orderGrowth}% vs mês anterior
              </p>
            </div>
          </div>
        </Card>

        {/* Total Revenue */}
        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Receita Total
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                R$ {reportData.totalRevenue.toLocaleString("pt-BR")}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                +{reportData.revenueGrowth}% vs mês anterior
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Report Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customers Report */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Relatório de Clientes
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">
                Clientes Ativos
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                245
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">
                Novos Clientes
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                35
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">
                Taxa de Retenção
              </span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                92%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">
                Valor Médio por Cliente
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                R$ 53.00
              </span>
            </div>
          </div>
        </Card>

        {/* Appointments Report */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Relatório de Agendamentos
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">
                Agendamentos Confirmados
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                78
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">
                Agendamentos Cancelados
              </span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                8
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">
                Taxa de No-show
              </span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                5%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">
                Tempo Médio de Atendimento
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                45 min
              </span>
            </div>
          </div>
        </Card>

        {/* Financial Report */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Relatório Financeiro
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">
                Receita Total
              </span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                R$ 15,420.50
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">
                Despesas Totais
              </span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                R$ 3,200.00
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">
                Lucro Líquido
              </span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                R$ 12,220.50
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">
                Margem de Lucro
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                79.2%
              </span>
            </div>
          </div>
        </Card>

        {/* Services Report */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Relatório de Serviços
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">
                Ordens Completadas
              </span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                85
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">
                Ordens em Progresso
              </span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                12
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">
                Ordens Canceladas
              </span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                2
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">
                Taxa de Satisfação
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                4.8/5
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
