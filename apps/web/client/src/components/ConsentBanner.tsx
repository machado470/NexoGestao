import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

/**
 * Banner de consentimento de dados (LGPD)
 * Exibe uma vez por sessão
 */
export function ConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [preferences, setPreferences] = useState({
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
    await recordConsents({
      marketing: true,
      analytics: true,
      cookies: true,
    });
    setIsVisible(false);
    sessionStorage.setItem('consent-banner-shown', 'true');
  };

  const handleRejectAll = async () => {
    await recordConsents({
      marketing: false,
      analytics: false,
      cookies: true, // Essencial
    });
    setIsVisible(false);
    sessionStorage.setItem('consent-banner-shown', 'true');
  };

  const handleCustomize = async () => {
    await recordConsents(preferences);
    setIsVisible(false);
    sessionStorage.setItem('consent-banner-shown', 'true');
  };

  const recordConsents = async (prefs: typeof preferences) => {
    try {
      // Enviar para backend
      await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
    } catch (error) {
      console.error('Erro ao registrar consentimento:', error);
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
              <a href="/privacy" className="text-blue-600 hover:underline">
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
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleRejectAll}>
            Rejeitar Tudo
          </Button>
          <Button variant="outline" onClick={handleCustomize}>
            Personalizar
          </Button>
          <Button onClick={handleAcceptAll}>Aceitar Tudo</Button>
        </div>
      </div>
    </div>
  );
}
