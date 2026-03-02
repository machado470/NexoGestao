/**
 * Página de Termos de Serviço
 */

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
          Termos de Serviço
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 space-y-8 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              1. Aceitação dos Termos
            </h2>
            <p>
              Ao acessar e usar o NexoGestão, você aceita estar vinculado por estes Termos de
              Serviço. Se você não concorda com qualquer parte destes termos, não use o serviço.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              2. Descrição do Serviço
            </h2>
            <p>
              NexoGestão é uma plataforma de gestão de negócios que oferece funcionalidades para
              gerenciar clientes, agendamentos, ordens de serviço, financeiro e governança.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              3. Conta do Usuário
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Você é responsável por manter a confidencialidade de sua senha</li>
              <li>Você é responsável por todas as atividades em sua conta</li>
              <li>Você concorda em fornecer informações precisas e completas</li>
              <li>Você concorda em notificar imediatamente sobre acesso não autorizado</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              4. Uso Aceitável
            </h2>
            <p className="mb-4">Você concorda em não:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Usar o serviço para fins ilegais ou não autorizados</li>
              <li>Violar qualquer lei ou regulamento aplicável</li>
              <li>Infringir direitos de propriedade intelectual</li>
              <li>Transmitir malware ou código malicioso</li>
              <li>Interferir com o funcionamento do serviço</li>
              <li>Acessar dados de outros usuários sem autorização</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              5. Propriedade Intelectual
            </h2>
            <p>
              O NexoGestão e seu conteúdo são propriedade exclusiva da empresa. Você não pode
              reproduzir, distribuir ou transmitir qualquer conteúdo sem permissão prévia.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              6. Limitação de Responsabilidade
            </h2>
            <p>
              O serviço é fornecido "como está" sem garantias. Não somos responsáveis por danos
              indiretos, incidentais, especiais ou consequentes resultantes do uso do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              7. Indenização
            </h2>
            <p>
              Você concorda em indenizar e manter indemne a empresa de qualquer reclamação,
              dano ou despesa resultante do seu uso do serviço ou violação destes termos.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              8. Rescisão
            </h2>
            <p>
              Podemos rescindir sua conta a qualquer momento, com ou sem causa, mediante aviso
              prévio. Você pode rescindir sua conta a qualquer momento.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              9. Alterações aos Termos
            </h2>
            <p>
              Reservamos o direito de modificar estes termos a qualquer momento. Continuando a
              usar o serviço após as alterações, você aceita os novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              10. Contato
            </h2>
            <p>
              Para dúvidas sobre estes Termos de Serviço, entre em contato conosco através de
              support@nexogestao.com.br
            </p>
          </section>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-8 text-sm text-gray-500 dark:text-gray-400">
            <p>Última atualização: 02 de março de 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}
