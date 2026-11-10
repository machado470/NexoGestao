# Auditoria: período mensal financeiro — 2026-11-10

## Falha

ExpensesService misturava seleção de ano/mês em UTC com construção de Date e
rótulos no fuso do servidor. Também não consultava Organization.timezone.
Uma despesa ou pagamento perto da meia-noite podia entrar no mês errado.
O resultado financeiro recalculava o período ao chamar o resumo de despesas.

A reprodução inicial teve 6 testes falhando e 6 passando, incluindo limites,
mês padrão da organização e configuração de fuso ausente/inválida.

## Correção

- zonedMonthBounds calcula instantes UTC do mês civil no fuso IANA da organização,
  inclusive mudança de offset dentro do mês e meia-noite inexistente. Não soma
  dias/horas fixas nem usa o fuso local do processo.
- Mês explícito exige YYYY-MM válido (ano 0001–9999); mês omitido usa o calendário
  da organização na data atual. String vazia não equivale a mês omitido.
- Resumo e resultado usam a mesma resolução de fuso/período por chamada. Despesas
  avulsas e receitas usam início inclusivo e fim exclusivo. Recorrências usam
  o mesmo fim do mês. Rótulo month permanece o mês civil solicitado.
- Fuso ausente/inválido ou mês malformado retorna 400 antes das consultas financeiras.
- Endpoints, envelopes e isolamento por orgId preservados. valueInRisk/valueOpen
  continuam sendo a carteira atual, sem filtro mensal; política de recorrência e
  arquivamento histórico não foi alterada. Leituras não escrevem eventos.

## Verificação

Testes de calendário: ano bissexto, virada de ano, Kathmandu (45 minutos), UTC+14,
São Paulo/Nova York com horário de verão, lacuna à meia-noite em Cairo e ano 0001.
Testes de serviço verificam dados imediatamente antes/no início/no fim do mês,
receitas e despesas no mesmo período, fuso do tenant consultado apenas uma vez,
mês padrão ainda em novembro enquanto UTC já está em dezembro e falha explícita
para parâmetros inválidos. Persistência simulada; nenhuma alteração em dados reais.

Sem migração. A interpretação de formulários que produzem os instantes persistidos
não faz parte desta alteração.

Resultado local: 162 suítes / 1.079 testes da API aprovados; TypeScript, build dos
três pacotes, validador Operating System e `git diff --check` aprovados.

Compatibilidade: Node 20.20.2 / ICU 78.2 reproduziu uma divergência de `iso8601`
na borda do ano 0001 (1 falha / 24 sucessos na suíte focada). O formatador usa
`gregory`, consistente com o calendário gregoriano proléptico das âncoras Date.
A suíte completa foi repetida no Node 20: 162 suítes / 1.079 testes aprovados.
No Node 24, os 25 testes focados também passaram após a correção.
