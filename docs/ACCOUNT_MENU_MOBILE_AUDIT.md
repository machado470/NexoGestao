# Menu da conta: toque e contraste

O nome da conta e as ações do menu portaled usavam tokens de texto que podiam conservar cores claras no tema claro. Perfil/Tema/Sair também usavam altura de 32 px, pequena para toque.

O nome e as ações usam agora o texto do portal, inclusive no foco. As três opções têm altura mínima de 44 px. Rotas, troca de tema, sessão, permissões e logout não foram alterados.

Validação local:

- TypeScript e build Vite.
- `scripts/audits/account-menu-mobile.cjs`: Chromium com fixtures em 320/390/1280 px, claro/escuro; contraste do nome e das três opções >= 4,5:1 em repouso/foco; altura mínima 44 px; menu dentro da tela; seleção de Tema via seta/Enter fecha o menu e aplica o tema; Perfil fecha o menu mesmo na rota atual. Sem POSTs nem erros de página.
- `settings-navigation-guard.cjs`: regressão da proteção de saída de Configurações, incluindo cancelar Sair, navegação/Voltar/Avançar com manter ou descartar e salvamento pendente.

Os testes usam respostas simuladas. Não houve logout real nem alteração em registros externos. Safari/iPhone real e API de produção não foram testados.
