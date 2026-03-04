import { useEffect, useState } from "react";
import {
  Zap,
  Star,
  Gift,
  TrendingUp,
  Lightbulb,
  Award,
  Rocket,
  Heart,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";

interface SystemAnnouncement {
  id: number;
  title: string;
  description: string;
  icon: string;
  color: string;
  badge?: string;
  priority: "high" | "medium" | "low";
  cta?: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Zap: <Zap className="w-5 h-5" />,
  Star: <Star className="w-5 h-5" />,
  Gift: <Gift className="w-5 h-5" />,
  TrendingUp: <TrendingUp className="w-5 h-5" />,
  Lightbulb: <Lightbulb className="w-5 h-5" />,
  Award: <Award className="w-5 h-5" />,
  Rocket: <Rocket className="w-5 h-5" />,
  Heart: <Heart className="w-5 h-5" />,
  Clock: <Clock className="w-5 h-5" />,
  CheckCircle: <CheckCircle className="w-5 h-5" />,
  AlertCircle: <AlertCircle className="w-5 h-5" />,
};

const COLOR_MAP: Record<string, string> = {
  "orange-500": "from-orange-400 to-orange-600",
  "blue-500": "from-blue-400 to-blue-600",
  "green-500": "from-green-400 to-green-600",
  "purple-500": "from-purple-400 to-purple-600",
  "pink-500": "from-pink-400 to-pink-600",
  "red-500": "from-red-400 to-red-600",
  "indigo-500": "from-indigo-400 to-indigo-600",
  "cyan-500": "from-cyan-400 to-cyan-600",
  "yellow-500": "from-yellow-400 to-yellow-600",
};

const SYSTEM_ANNOUNCEMENTS: SystemAnnouncement[] = [
  {
    id: 1,
    title: "Economia Garantida",
    description: "Economize até 40% com planos anuais. Quanto maior o plano, maior o desconto!",
    icon: "Gift",
    color: "green-500",
    badge: "ATIVO",
    priority: "high",
    cta: "Ver Planos",
  },
  {
    id: 2,
    title: "Teste Gratuito",
    description: "14 dias de teste completo em qualquer plano. Sem cartão de crédito necessário.",
    icon: "Star",
    color: "blue-500",
    badge: "NOVO",
    priority: "high",
    cta: "Começar Teste",
  },
  {
    id: 3,
    title: "Suporte 24/7",
    description: "Clientes Premium têm acesso a suporte prioritário em todos os canais.",
    icon: "Zap",
    color: "orange-500",
    priority: "medium",
  },
  {
    id: 4,
    title: "Integração WhatsApp",
    description: "Conecte WhatsApp Business e gerencie clientes diretamente da plataforma.",
    icon: "Rocket",
    color: "cyan-500",
    priority: "medium",
  },
  {
    id: 5,
    title: "Relatórios Avançados",
    description: "Gere relatórios customizados em PDF, Excel e outros formatos.",
    icon: "TrendingUp",
    color: "purple-500",
    priority: "medium",
  },
  {
    id: 6,
    title: "API Access",
    description: "Integre com suas ferramentas favoritas via API robusta e documentada.",
    icon: "Lightbulb",
    color: "indigo-500",
    priority: "low",
  },
];

interface AdsColumnProps {
  className?: string;
  showHeader?: boolean;
}

export function AdsColumn({ className = "", showHeader = true }: AdsColumnProps) {
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);

  useEffect(() => {
    // Simular carregamento de anúncios
    setTimeout(() => {
      setAnnouncements(SYSTEM_ANNOUNCEMENTS);
      setLoading(false);
    }, 300);
  }, []);

  const handleDismiss = (id: number) => {
    setDismissedIds([...dismissedIds, id]);
  };

  const visibleAnnouncements = announcements.filter(
    (a) => !dismissedIds.includes(a.id)
  );

  // Ordenar por prioridade
  const sortedAnnouncements = [...visibleAnnouncements].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  if (loading) {
    return (
      <aside className={`hidden lg:flex flex-col w-80 ${className}`}>
        <div className="space-y-4 p-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`hidden lg:flex flex-col w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent ${className}`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        {showHeader && (
          <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-500" />
              Benefícios & Promoções
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Confira as melhores ofertas do sistema
            </p>
          </div>
        )}

        {/* Announcements List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {sortedAnnouncements.length > 0 ? (
            sortedAnnouncements.map((announcement, index) => {
              const icon = ICON_MAP[announcement.icon] || ICON_MAP["Star"];
              const gradient =
                COLOR_MAP[announcement.color] || COLOR_MAP["orange-500"];

              return (
                <div
                  key={announcement.id}
                  className={`
                    bg-gradient-to-br ${gradient} rounded-lg p-3 text-white
                    shadow-sm hover:shadow-md transition-all duration-300
                    transform hover:scale-105 cursor-pointer
                    relative group border border-white/20
                  `}
                  style={{
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  {/* Dismiss Button */}
                  <button
                    onClick={() => handleDismiss(announcement.id)}
                    className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 hover:bg-white/30 rounded-md"
                    title="Descartar"
                  >
                    <X className="w-3 h-3" />
                  </button>

                  {/* Icon and Badge */}
                  <div className="flex items-start justify-between mb-2 pr-6">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      {icon}
                    </div>
                    {announcement.badge && (
                      <span className="text-xs font-bold bg-white/30 px-2 py-1 rounded-full backdrop-blur-sm">
                        {announcement.badge}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <h4 className="font-semibold text-sm mb-1 line-clamp-1">
                    {announcement.title}
                  </h4>
                  <p className="text-xs opacity-90 line-clamp-2 mb-2">
                    {announcement.description}
                  </p>

                  {/* CTA Button */}
                  {announcement.cta && (
                    <button className="w-full mt-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-md transition-colors backdrop-blur-sm">
                      {announcement.cta}
                    </button>
                  )}

                  {/* Priority Indicator */}
                  {announcement.priority === "high" && (
                    <div className="mt-2 pt-2 border-t border-white/20 flex items-center gap-1">
                      <span className="text-xs font-semibold">⚡ Destaque</span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
              <p className="text-sm">Nenhum anúncio no momento</p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 sticky bottom-0 bg-white dark:bg-gray-900 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            💡 Todos os planos incluem teste gratuito de 14 dias
          </p>
        </div>
      </div>
    </aside>
  );
}
