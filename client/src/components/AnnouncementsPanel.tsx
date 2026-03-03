import { Sparkles, Lightbulb, Gift, Zap } from "lucide-react";

export function AnnouncementsPanel() {
  return (
    <aside className="hidden lg:flex flex-col w-72 bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent animate-slideInRight">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            Anúncios
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Promoções e dicas
          </p>
        </div>

        {/* Announcement 1 - Premium Feature */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-4 border border-orange-200 dark:border-orange-700/50 hover:shadow-lg transition-all">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold flex-shrink-0">
              ⭐
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-orange-900 dark:text-orange-100 text-sm">
                Plano Premium
              </h4>
              <p className="text-xs text-orange-800 dark:text-orange-200 mt-1">
                Desbloqueie recursos avançados e relatórios em tempo real
              </p>
              <button className="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold py-2 rounded-lg transition-colors">
                Saiba Mais
              </button>
            </div>
          </div>
        </div>

        {/* Announcement 2 - Tip */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700/50 hover:shadow-lg transition-all">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 text-sm">
                Dica do Dia
              </h4>
              <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                Use filtros avançados para encontrar clientes rapidamente
              </p>
            </div>
          </div>
        </div>

        {/* Announcement 3 - Update */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 border border-green-200 dark:border-green-700/50 hover:shadow-lg transition-all">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center text-white font-bold flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-green-900 dark:text-green-100 text-sm">
                Nova Atualização
              </h4>
              <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                Relatórios financeiros agora com gráficos interativos
              </p>
            </div>
          </div>
        </div>

        {/* Announcement 4 - Promotion */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700/50 hover:shadow-lg transition-all">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0">
              <Gift className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-purple-900 dark:text-purple-100 text-sm">
                Oferta Especial
              </h4>
              <p className="text-xs text-purple-800 dark:text-purple-200 mt-1">
                30% de desconto em planos anuais - Válido até domingo
              </p>
              <button className="mt-3 w-full bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold py-2 rounded-lg transition-colors">
                Aproveitar
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">
            Seu Desempenho
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Clientes Ativos
              </span>
              <span className="text-sm font-bold text-orange-500">258</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Taxa de Conversão
              </span>
              <span className="text-sm font-bold text-green-500">12%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Receita Mês
              </span>
              <span className="text-sm font-bold text-blue-500">R$ 45K</span>
            </div>
          </div>
        </div>

        {/* Contact Support */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-400 flex items-center justify-center text-white font-bold flex-shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                Precisa de Ajuda?
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Entre em contato com nosso suporte
              </p>
              <button className="mt-3 w-full bg-gray-400 hover:bg-gray-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors">
                Contatar
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
