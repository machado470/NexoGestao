# Disponibilidade da equipe: validação e falhas visíveis

## Correção

O formulário usava `new Date(...).toISOString()` sem validar o intervalo local e não apresentava erro de criação ou remoção. Agora reutiliza o conversor local já usado nos demais formulários para rejeitar datas inválidas, horários locais inexistentes e intervalos com fim igual ou anterior ao início.

Erros de cadastro ficam visíveis junto ao formulário, preservando seus campos. Erros de remoção aparecem junto à lista e não removem visualmente o registro. Os campos são bloqueados durante operações; bloqueios síncronos impedem cliques duplicados antes da próxima renderização, tanto ao adicionar quanto ao remover.

Nenhuma regra de disponibilidade do backend foi alterada; a API continua sendo a fonte oficial. Não houve integração externa.

## Verificação

- Frontend completo: 92 arquivos, 755 testes passaram.
- Oito novos testes cobrem campos ausentes, data inválida, intervalo igual ou invertido, conversão local em ISO e passagem pela meia-noite. A validação de horário local inexistente reutiliza o helper com cobertura de mudança de horário de verão existente.
- Typecheck final, build, lint e `git diff --check` passaram.
- Chromium no fuso America/Sao_Paulo, com API, BFF e PostgreSQL locais: intervalo invertido não enviou requisição; HTTP 503 no cadastro preservou os horários; repetição com dois cliques síncronos produziu uma criação. O horário de 10h–11h foi persistido como 13h–14h UTC. HTTP 503 na remoção manteve o registro; repetição com dois cliques enviou uma remoção e confirmou ausência no banco.
- Script temporário em `work/availability-browser.cjs`. WhatsApp permaneceu mock; serviços e banco temporários foram encerrados após a validação.
