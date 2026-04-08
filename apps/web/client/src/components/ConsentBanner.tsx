import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { saveConsent, type ConsentPreferences } from './ConsentBanner.logic';

/**
 * Banner de consentimento de dados (LGPD)
 * Exibe uma vez por sessão
 */
export function ConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    marketing: false,
    analytics: false,
    cookies: true, // Essencial
  });

  useEffect(() => {
    // Verificar se já consentiu nesta sessão
    const hasConsented = sessionStorage.getItem('consent-banner-shown');
    if (!hasConsented) {
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = async () => {
    const ok = await recordConsents({
      marketing: true,
      analytics: true,
      cookies: true,
    });
    if (!ok) return;
    closeBanner();
  };

  const handleRejectAll = async () => {
    const ok = await recordConsents({
      marketing: false,
      analytics: false,
      cookies: true, // Essencial
    });
    if (!ok) return;
    closeBanner();
  };

  const handleCustomize = async () => {
    const ok = await recordConsents(preferences);
    if (!ok) return;
    closeBanner();
  };

  const closeBanner = () => {
    setIsVisible(false);
    sessionStorage.setItem('consent-banner-shown', 'true');
  };

  const recordConsents = async (prefs: ConsentPreferences) => {
    setIsSubmitting(true);

    try {
      return await saveConsent(prefs);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Sua Privacidade
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Usamos cookies e tecnologias similares para melhorar sua experiência. Você pode
              personalizar suas preferências ou aceitar todas. Leia nossa{' '}
              <a href="/privacy" className="text-primary hover:underline">
                Política de Privacidade
              </a>
              .
            </p>

            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Cookies Essenciais (obrigatório)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.analytics}
                  onChange={(e) =>
                    setPreferences({ ...preferences, analytics: e.target.checked })
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Análise e Performance
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.marketing}
                  onChange={(e) =>
                    setPreferences({ ...preferences, marketing: e.target.checked })
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Marketing e Publicidade
                </span>
              </label>
            </div>
          </div>

          <button
            onClick={() => setIsVisible(false)}
            disabled={isSubmitting}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleRejectAll} disabled={isSubmitting}>
            Rejeitar Tudo
          </Button>
          <Button variant="outline" onClick={handleCustomize} disabled={isSubmitting}>
            Personalizar
          </Button>
          <Button onClick={handleAcceptAll} disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Aceitar Tudo'}
          </Button>
        </div>
      </div>
    </div>
  );
}
