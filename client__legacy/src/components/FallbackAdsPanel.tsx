import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Star,
  Gift,
  TrendingUp,
  Lightbulb,
  Award,
  Rocket,
  Heart,
  ExternalLink,
  Loader,
} from "lucide-react";

interface Promotion {
  id: number;
  title: string;
  description: string;
  image?: string;
  icon?: string;
  color?: string;
  ctaText: string;
  ctaLink?: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Zap: <Zap className="w-6 h-6" />,
  Star: <Star className="w-6 h-6" />,
  Gift: <Gift className="w-6 h-6" />,
  TrendingUp: <TrendingUp className="w-6 h-6" />,
  Lightbulb: <Lightbulb className="w-6 h-6" />,
  Award: <Award className="w-6 h-6" />,
  Rocket: <Rocket className="w-6 h-6" />,
  Heart: <Heart className="w-6 h-6" />,
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
};

interface FallbackAdsPanelProps {
  show: boolean;
}

export function FallbackAdsPanel({ show }: FallbackAdsPanelProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  // Buscar promoções ativas
  const promotionsQuery = trpc.promotions?.list?.useQuery?.({ active: true }) || {
    data: undefined,
    isLoading: true,
    error: null,
  };

  useEffect(() => {
    if (promotionsQuery.data) {
      setPromotions(promotionsQuery.data as Promotion[]);
      setLoading(false);
    } else if (promotionsQuery.error) {
      setLoading(false);
    }
  }, [promotionsQuery.data, promotionsQuery.error]);

  if (!show || loading) {
    return null;
  }

  // Se não houver promoções, mostrar promoções padrão
  const displayPromotions =
    promotions.length > 0
      ? promotions
      : [
          {
            id: 1,
            title: "Plano Premium",
            description: "Desbloqueie recursos avançados e aumente sua produtividade",
            icon: "Star",
            color: "orange-500",
            ctaText: "Saiba Mais",
            ctaLink: "/premium",
          },
          {
            id: 2,
            title: "Integração WhatsApp",
            description: "Conecte sua conta WhatsApp Business e gerencie mensagens",
            icon: "Zap",
            color: "green-500",
            ctaText: "Conectar",
            ctaLink: "/integrations/whatsapp",
          },
          {
            id: 3,
            title: "Relatórios Avançados",
            description: "Gere relatórios detalhados e exporte em múltiplos formatos",
            icon: "TrendingUp",
            color: "blue-500",
            ctaText: "Explorar",
            ctaLink: "/reports",
          },
        ];

  return (
    <aside className="hidden lg:flex flex-col w-80 bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent animate-slideInRight">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="px-2 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Promoções & Ofertas
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Confira as melhores ofertas
          </p>
        </div>

        {/* Promotions List */}
        <div className="space-y-3">
          {displayPromotions.map((promo, index) => {
            const icon = ICON_MAP[promo.icon || "Star"];
            const gradient =
              COLOR_MAP[promo.color || "orange-500"] || COLOR_MAP["orange-500"];

            return (
              <div
                key={promo.id || index}
                className={`
                  bg-gradient-to-br ${gradient} rounded-lg p-4 text-white
                  shadow-md hover:shadow-lg transition-all duration-300
                  transform hover:scale-105 cursor-pointer
                  animate-fadeIn
                `}
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                {/* Icon */}
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    {icon}
                  </div>
                  <ExternalLink className="w-4 h-4 opacity-70" />
                </div>

                {/* Content */}
                <h4 className="font-semibold text-sm mb-1">{promo.title}</h4>
                <p className="text-xs opacity-90 mb-3 line-clamp-2">
                  {promo.description}
                </p>

                {/* CTA Button */}
                <Button
                  onClick={() => {
                    if (promo.ctaLink) {
                      window.location.href = promo.ctaLink;
                    }
                  }}
                  className="w-full h-8 text-xs bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                >
                  {promo.ctaText}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="px-2 py-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            💡 Dica: Atualize para Premium para desbloquear mais recursos
          </p>
        </div>
      </div>
    </aside>
  );
}
