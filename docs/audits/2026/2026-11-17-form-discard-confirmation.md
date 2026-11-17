# Confirmação de descarte dos formulários

## Comportamento

O fechamento dos cadastros de cliente, O.S., cobrança e agendamento agora usa a mesma confirmação visual. O formulário principal de Agendamentos também protege a edição. Cancelar, X, Escape e toque fora passam pela mesma decisão: continuar editando preserva campos e devolve o foco; descartar limpa o cadastro e fecha. Uma gravação pendente impede o fechamento. O sucesso da gravação segue o fluxo existente e não pede descarte.

A comparação considera o formulário inicial: cliente contextual, prioridade padrão da O.S., duração e horários existentes de um agendamento não contam como alterações feitas pelo usuário. Seleções e campos efetivamente alterados contam. Confirmações nativas `window.confirm` foram removidas dos cadastros de Cliente e O.S.; não há alteração dos contratos de gravação ou permissões.

Enquanto um formulário aberto possui alterações não salvas, `beforeunload` solicita a proteção nativa do navegador contra recarregar ou sair da página. Esse evento é limitado pelos navegadores e não garante proteção ao encerrar um aplicativo no celular. Os rascunhos permanecem apenas na memória da tela, sem armazenamento persistente.

## Verificação

- Typecheck web e build Vite de produção.
- 45 testes existentes das páginas operacionais e da navegação financeira passaram.
- Script de navegador `scripts/audits/form-discard.cjs`, com Chromium e fixtures de API locais: 320, 390 e 1366 px; cinco pontos de entrada (Agendamentos, Calendário, Clientes, O.S. e Financeiro).
- Em cada entrada: fechar intacto sem alerta; Cancelar, Escape, X e clique fora com alterações; continuar e preservar os valores; retorno do foco; descartar e reabrir limpo; registro e remoção do aviso de recarga; ausência de confirmação nativa e de transbordamento horizontal na confirmação.
- A edição de agendamento existente verifica fechamento intacto sem aviso, preservação do rascunho e descarte sem alterar o registro persistido.
- A gravação simulada de agendamento verifica bloqueio enquanto pendente, preservação após erro e fechamento direto após sucesso. As respostas são interceptadas no localhost; nenhuma escrita em produção.

Para repetir, iniciar o Vite web em `http://localhost:5173`, disponibilizar o pacote `playwright` e executar `node scripts/audits/form-discard.cjs` (ou usar `NODE_PATH` para a instalação do Playwright). O script usa `/usr/bin/chromium`. `FORM_CASE=customers` limita a execução a uma entrada para diagnóstico.

## Limites e próximos pontos

Não adiciona bloqueio da navegação interna do aplicativo ou do botão Voltar do histórico. Não altera os formulários de edição específicos de Cliente e O.S., Configurações, Perfil ou WhatsApp. Esses pontos precisam de integração própria com navegação e ciclo de vida dos respectivos formulários. Safari/iPhone físico e o percurso autenticado no Railway continuam como homologação posterior ao deploy.

Sem alteração de API, banco ou configuração Railway. Merge manual; o serviço web publica a branch acompanhada após o merge.
