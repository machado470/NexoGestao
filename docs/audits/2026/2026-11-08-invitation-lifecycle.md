# Ciclo de convites administrativos — 2026-11-08

## Entrega

Configurações mostra os estados oficiais de convite pendente, expirado e revogado. Administradores ativos podem reenviar um convite existente, inclusive expirado/revogado, ou revogar seu link após confirmação. Membros já ativados não recebem essas ações.

A API mantém as rotas existentes e adiciona `POST /auth/invites/:id/resend` e `POST /auth/invites/:id/revoke`. O BFF recebe apenas o UUID do registro; tenant e autoria vêm da sessão autenticada. Não houve migration ou mudança de papel/organização de contas existentes.

O reenvio substitui o token, renova a validade por sete dias e preserva e-mail/papel/tenant. Se o provedor falha, o token anterior é restaurado somente quando a tentativa ainda possui o token atual; a compensação não desfaz aceite, revogação ou reenvio posterior. A revogação remove o token sem excluir o registro e é idempotente. Um novo reenvio explícito pode reabrir um convite revogado.

O aceite consome o token com atualização condicional dentro da mesma transação que ativa a conta, cria a pessoa e registra auditoria. Se o token mudou, expirou, foi revogado ou consumido durante a operação, nenhuma pessoa/sessão é criada. As consultas e atualizações administrativas filtram o tenant e exigem uma conta de convite ainda sem senha, sem pessoa e inativa.

A auditoria registra `INVITE_RESEND_REQUESTED`, `INVITE_RESEND_FAILED`, `INVITE_REVOKED` e `INVITE_ACCEPTED`. Tokens e hashes não aparecem nas respostas ou na auditoria. A listagem mantém `pendingInvites` por compatibilidade e adiciona `invitations` com o estado calculado pela API.

## Validação e limites

Build e checagem de tipos dos três pacotes e lint operacional web aprovados. Suítes completas: 673 testes API aprovados (47 ignorados em 18 suítes reais opt-in) e 592 testes web aprovados. Esta entrega adiciona 26 casos, entre serviço, guards/encaminhamento administrativo, BFF e renderização.

Testes específicos cobrem isolamento, autorização administrativa, encaminhamento pelo BFF, falha/compensação do provedor, estado expirado/revogado, aceite condicional e revogação repetida. Os testes usam doubles de Prisma e do serviço de e-mail: não equivalem a uma prova concorrente em PostgreSQL real nem à entrega externa de e-mail.

Continuam pendentes validação com provedores reais de e-mail, Stripe e WhatsApp, teste real de concorrência com banco e rastreamento dedicado dos eventos de envio na timeline. Alteração de papel e ativação/desativação de membros existentes continuam fora desta entrega.
