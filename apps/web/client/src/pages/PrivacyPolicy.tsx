/**
 * Página de Política de Privacidade (LGPD)
 */

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
          Política de Privacidade
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 space-y-8 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              1. Introdução
            </h2>
            <p>
              O NexoGestão ("nós", "nosso" ou "empresa") está comprometido em proteger sua
              privacidade. Esta Política de Privacidade explica como coletamos, usamos, divulgamos
              e protegemos suas informações.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              2. Informações que Coletamos
            </h2>
            <p className="mb-4">Coletamos informações que você nos fornece diretamente:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Informações de conta (nome, email, telefone)</li>
              <li>Informações de clientes e contatos</li>
              <li>Informações de agendamentos e serviços</li>
              <li>Informações financeiras e de pagamento</li>
              <li>Logs de atividade e auditoria</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              3. Como Usamos Suas Informações
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Fornecer e melhorar o serviço</li>
              <li>Processar transações e enviar confirmações</li>
              <li>Enviar atualizações e comunicações de marketing</li>
              <li>Responder a suas perguntas e solicitações</li>
              <li>Cumprir obrigações legais</li>
              <li>Prevenir fraude e atividades ilegais</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              4. Compartilhamento de Informações
            </h2>
            <p>
              Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros,
              exceto quando necessário para fornecer o serviço ou cumprir a lei.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              5. Segurança de Dados
            </h2>
            <p>
              Implementamos medidas de segurança técnicas e organizacionais para proteger suas
              informações contra acesso não autorizado, alteração, divulgação ou destruição.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              6. Retenção de Dados
            </h2>
            <p>
              Retemos suas informações pessoais pelo tempo necessário para fornecer o serviço e
              cumprir obrigações legais. Você pode solicitar a exclusão de seus dados a qualquer
              momento.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              7. Direitos do Titular de Dados (LGPD)
            </h2>
            <p className="mb-4">De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados imprecisos</li>
              <li>Solicitar a exclusão de seus dados (direito ao esquecimento)</li>
              <li>Revogar consentimento a qualquer momento</li>
              <li>Portabilidade de dados</li>
              <li>Receber informações sobre como seus dados são usados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              8. Cookies e Tecnologias de Rastreamento
            </h2>
            <p>
              Usamos cookies para melhorar sua experiência. Você pode controlar as preferências
              de cookies em suas configurações de navegador. Alguns cookies são essenciais para
              o funcionamento do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              9. Alterações a Esta Política
            </h2>
            <p>
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você
              sobre mudanças significativas por email ou aviso na plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              10. Contato
            </h2>
            <p>
              Para dúvidas sobre esta Política de Privacidade ou para exercer seus direitos LGPD,
              entre em contato conosco:
            </p>
            <div className="mt-4 space-y-2">
              <p>Email: privacy@nexogestao.com.br</p>
              <p>Telefone: +55 (11) 3000-0000</p>
              <p>Endereço: São Paulo, SP, Brasil</p>
            </div>
          </section>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-8 text-sm text-gray-500 dark:text-gray-400">
            <p>Última atualização: 02 de março de 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}
