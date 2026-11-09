# Concorrência na edição de acessos

## Correção

Os modais usavam `member.updatedAt` das props no momento do envio. Uma consulta atualizada com o modal aberto substituía essa versão, permitindo enviar uma decisão anterior com uma versão mais recente. O modal de ativação também derivava sua intenção do estado mais recente das props, podendo inverter a ação escolhida.

Agora a abertura de cada modal captura id, e-mail, papel, estado ativo e versão. O envio mantém essa versão e a confirmação mantém a intenção original de ativar ou desativar. A API existente continua responsável pela rejeição de versões antigas. Após conflito, o usuário pode cancelar, atualizar a lista e reabrir o modal para revisar os valores atuais.

A seção oferece `Atualizar acessos`. Falhas de leitura com cache mantêm a lista visível com aviso de possível desatualização. A alteração de um membro confirmada pela API fecha os modais e informa sucesso antes de consultar a lista; falhas dessa consulta produzem aviso separado, sem converter a gravação em erro.

## Verificação

- Frontend completo: 86 arquivos, 672 testes passaram. Um novo teste cobre manutenção da lista em cache e acesso à atualização após falha de leitura.
- Typecheck, build, lint e `git diff --check` passaram.
- Chromium com API e BFF reais, PostgreSQL e Redis locais, banco temporário migrado:
  - Modal de papel aberto em STAFF, seleção local de VIEWER, atualização remota para MANAGER e atualização da consulta com modal aberto. O envio manteve a versão de STAFF, recebeu conflito e preservou MANAGER no banco.
  - Reabertura com a versão atual permitiu salvar VIEWER. A consulta posterior recebeu HTTP 503; o modal fechou, o sucesso e o aviso de lista foram exibidos, e o banco confirmou VIEWER. A lista em cache continuou disponível.
  - Confirmação de desativação aberta com usuário ativo, desativação remota e atualização da consulta com modal aberto. O envio manteve `active: false` e a versão original, recebeu conflito e preservou o usuário inativo.
- A atualização de consulta com modal aberto foi acionada programaticamente no navegador para reproduzir o equivalente a uma atualização em segundo plano. O script temporário está em `work/member-snapshot-browser.cjs`.
- Não houve alteração no backend nem exercício de integrações externas. WhatsApp permaneceu mock. Os serviços locais de teste foram encerrados após a validação.
