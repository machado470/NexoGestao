# Continuidade por perfil no celular — 18/11/2026

A revisão encontrou dois atalhos que contrariavam as permissões existentes: Equipe podia escolher Criar cobrança no cadastro de cliente, e recebia Ir para Financeiro no aviso de O.S. criada, embora não possua finance:read/finance:update.

A escolha de próximo passo do cliente agora consulta o can() de lib/rbac.ts. Cobrança exige leitura e alteração financeira; agenda exige criação de agendamento. Todos os passos de criação exigem customers:create. Equipe mantém agenda, WhatsApp e Apenas cadastrar. O submit verifica novamente se a escolha é permitida antes de persistir. A confirmação só oferece a continuidade se o perfil atual puder usá-la.

O aviso de O.S. criada encaminha Administrador/Gerente ao Financeiro e Equipe à própria O.S., com texto sobre acompanhar execução. Não foi adicionada permissão, papel ou rota nova, nem alterada autorização do serviço.

Validação: 51 testes de continuidade, matriz de permissões e contratos de navegação/operacionais; TypeScript e build Vite passaram. O roteiro scripts/audits/mobile-role-continuation.cjs testou em 320 e 390 px os quatro papéis: Administrador/Gerente com cobrança disponível, Equipe sem essa escolha e com aviso de O.S. acessível, e Visualizador sem botão de cadastrar cliente. Também verificou que o fluxo de Equipe/Visualizador não disparou consultas finance.*. A jornada completa scripts/audits/mobile-customer-to-payment.cjs passou novamente para Administrador.

As sessões, consultas e gravações dos roteiros são fixtures locais. Isto verifica a interface por perfil, não a autorização do backend real. Não houve cadastro/O.S./cobrança real; Safari/iPhone e API de produção não foram testados nesta rodada.
