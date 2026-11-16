# Preservação da sessão de edição de Pessoas

## Problema e correção

O editor reconstruía o formulário quando a consulta de detalhe mudava e enviava o `updatedAt` mais recente dessa consulta. Isso podia apagar capacidade e nota em edição ou enviar uma decisão anterior usando uma versão que o usuário não havia revisado.

O editor agora mantém formulário inicial, rascunho e versão em uma sessão. Consultas em segundo plano do mesmo cadastro não substituem nenhum desses elementos. Trocar de pessoa ou fechar e reabrir inicia nova sessão.

`Descartar` retorna aos valores revisados na abertura, sem avançar a versão. `Recarregar dados` consulta e adota os valores e a versão mais recentes, pedindo confirmação quando há alterações locais. A ação do aviso de conflito usa esse mesmo fluxo. Cancelamento e erro de recarga preservam o rascunho. Um erro de leitura com cache mantém o formulário visível.

A validação de capacidades usa os valores iniciais revisados, e o envio usa a versão da sessão. A API existente continua responsável por rejeitar atualizações concorrentes. Não houve alteração de backend ou integração externa.

## Verificação

- Frontend completo: 93 arquivos e 760 testes passaram.
- Cinco novos testes cobrem preservação de capacidade e nota sob atualização concorrente, adoção explícita de valores e versão, descarte, troca de pessoa e fechamento/reabertura.
- Recorte final dos estados de edição e capacidade: 22 testes passaram; build, typecheck e lint passaram, assim como `git diff --check`.
- Chromium com API, BFF e PostgreSQL locais: após alterar capacidade de 5 para 7 e escrever nota local, uma atualização remota para 9 seguida de reconexão refez a consulta sem substituir o rascunho. O envio manteve a versão original e recebeu conflito, preservando 9 no banco. Cancelar a recarga manteve 7 e a nota; uma recarga com HTTP 503 também preservou os campos. A recarga explícita adotou 9 e a nova versão, permitindo salvar 7 após revisão.
- A recarga assíncrona verifica também a identidade da sessão de edição para não aplicar uma resposta de uma sessão já fechada ou de outra pessoa.
- Script temporário em `work/person-session-browser.cjs`. WhatsApp permaneceu mock; nenhum envio externo foi exercitado. Serviços e banco temporários foram encerrados após a validação.
