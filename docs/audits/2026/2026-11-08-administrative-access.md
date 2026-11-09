# Validação de compilação e administração de acessos — 2026-11-08

## Diagnóstico e entrega

A checagem inicial de tipos dos três pacotes passou. Não foi reproduzido erro de TypeScript nesta revisão. O comando disponível no PATH inicial utilizava uma versão diferente do PNPM e tentava reinstalar dependências; a validação foi executada com o wrapper já preparado em `/workspace/.cloud-setup/bin`, que seleciona PNPM 10.30.3 conforme `packageManager`.

Configurações agora inclui consulta real de membros, estado ativo/inativo/convite pendente e envio de convites com os papéis suportados pela API. A seção usa o BFF existente e fica disponível somente para ADMIN. Pessoas continua dedicada à operação.

O fluxo anterior verificava a existência do usuário por tenant, mas executava upsert por e-mail globalmente único. Isso permitia sobrescrever o tenant de uma conta existente. O convite agora cria exclusivamente novas contas e recusa e-mails já cadastrados, sem transferir organização ou alterar papel de contas existentes. A resposta contém apenas os campos públicos do convite.

Os endpoints administrativos de convites e membros revalidam o usuário ativo, além do JWT e papel ADMIN. O envio valida a configuração do frontend antes de persistir; falha ou exceção do provedor retorna indisponibilidade e remove apenas o registro inativo criado nesta tentativa, filtrando id, tenant e token. Convites expirados preexistentes continuam sem fluxo de reenvio; isso já era bloqueado pela verificação anterior de usuário existente.

## Validação

- Build e checagem final de tipos dos três pacotes: aprovados.
- Suíte final web: 578 testes aprovados em 76 arquivos.
- Suíte final API: 652 testes aprovados em 126 suítes; 47 explicitamente ignorados em 18 suítes.
- Novos testes API: 10 aprovados, cobrindo isolamento de contas, configuração, normalização, falha de envio, resposta pública e guards administrativos.
- Novos testes de renderização web: 5 aprovados, cobrindo restrição de papel, membros reais, estados de erro/carregamento e falha de envio.
- Lint operacional web, testes do pacote comum e alinhamento Prisma: aprovados.
- Os testes novos de envio usam doubles do provedor; não comprovam entrega externa de e-mail.

## Pendências identificadas para próximas entregas

1. Validar envio e aceite real de convite com provedor configurado; definir reenvio/revogação de convites expirados e gestão de papel/ativação de membros com garantias administrativas.
2. Executar as suítes reais de integração com PostgreSQL e Redis; os skips da suíte padrão não equivalem a cobertura real de infraestrutura.
3. Validar Stripe e WhatsApp com credenciais e callbacks do ambiente alvo; o ambiente desta tarefa não anuncia segredos configurados.
4. Investigar os TODOs ainda presentes em WhatsAppPage sobre registro de pagamento, foco de cliente/financeiro e rastreamento dedicado na timeline. O comentário menciona `finance.markAsPaid`; conferir o contrato financeiro atual antes de implementar.

Essas pendências não são consideradas concluídas por esta entrega. Não houve alteração de schema, migration ou publicação.
