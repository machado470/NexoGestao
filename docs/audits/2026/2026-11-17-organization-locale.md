# Fuso da empresa e moeda das cobranças

## Problema e comportamento

Agendamentos, calendário, clientes, O.S., equipe e financeiro exibiam datas no fuso do dispositivo. O mesmo agendamento podia mudar de horário entre computadores. A nova consulta autenticada `/organization-settings/display-preferences` retorna somente `timezone` e `currency` da organização da sessão, sem abrir as configurações administrativas aos demais perfis.

As telas operacionais usam esse fuso para exibir instantes. Criação e edição de agendamentos, programação da O.S., indisponibilidade da equipe e vencimento de cobrança interpretam os controles no fuso da empresa. Um horário não editado preserva o instante original, incluindo segundos e milissegundos. Novos horários inexistentes ou ambíguos no horário de verão são rejeitados. O filtro de dia de agendamentos considera dias civis de 23 ou 25 horas. A grade FullCalendar usa o plugin oficial Luxon para fusos IANA.

Quando as preferências falham, a consulta permanece disponível com aviso de uso do fuso do dispositivo. Submissões que dependem de um novo horário exigem confirmação do fuso. Fechar os formulários continua permitido.

O Financeiro mostra a moeda persistida em cada cobrança. A preferência da empresa não relabela valores existentes. Os indicadores recebem as moedas dos registros da organização; com moedas diferentes, mostram as quantidades e explicam que os valores devem ser consultados por cobrança. Contratos sem moeda explícita permanecem indisponíveis. Novas cobranças continuam em BRL, declarado no formulário. Não há conversão cambial nem alteração da política financeira ou dos agregados de outros módulos.

## Validação

- 81 testes web (incluindo 39 regressões das páginas operacionais): transporte autenticado e contrato limitado; conversões de fuso; horário de verão; preservação de instantes; limites de dia; disponibilidade; moeda persistida e agregados; navegação financeira.
- 27 testes API: seleção dos campos e organização autenticada, permissões do endpoint limitado, manutenção das restrições administrativas, validação das configurações e metadados de moeda do financeiro.
- Typecheck web e API; build Vite de produção.
- Chromium local com respostas simuladas: lista, detalhe e retorno de Agendamentos, O.S. e Equipe; cartões, pagamento e cancelamento de Financeiro em 320/375/390/430 px; tabelas desktop e retorno de vínculo inexistente. Sem transbordamento horizontal nessas verificações.
- Navegador em UTC e empresa em `America/Sao_Paulo`: instante 12h UTC aparece como 9h no detalhe, no formulário de edição e na grade desktop do calendário. Cobrança BRL mantém reais sob preferência USD. Nenhuma escrita em produção.

## Deploy e limites

Sem migration. Publicar API antes do web é preferível; enquanto a API antiga estiver ativa, o web exibe o aviso e permite tentar novamente. Railway somente publica estas alterações depois do merge na branch acompanhada pelo serviço.

As verificações do navegador usam fixtures locais, não comprovam autenticação, persistência ou integrações no Railway. Após deploy, conferir com uma conta autorizada o carregamento do fuso e a consulta dos registros reais. Os dados financeiros existentes não são convertidos ou migrados.
