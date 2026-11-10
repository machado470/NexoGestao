# Auditoria: validação de despesas e lançamentos — 2026-11-10

## Evidências e falhas

Os PATCH de despesas e lançamentos declaravam `Partial<Create...Dto>`, um tipo
TypeScript sem classe de validação em runtime. A ValidationPipe não validava os
campos enviados. A criação usava IsNumber para centavos, sem limite compatível
com o Int do PostgreSQL; o dia de vencimento também aceitava frações. Serviços
verificavam somente valor positivo. Texto obrigatório contendo apenas espaços
passava na criação. Dados inválidos podiam chegar ao Prisma, falhar como erro
interno ou gravar texto vazio/categoria inválida em vez de responder 400.

A suíte HTTP escrita antes da correção teve 31 falhas e 6 sucessos, demonstrando
as lacunas no contrato de entrada sem acessar banco real.

## Correção

- UpdateExpenseDto e UpdateLaunchDto concretos, usando PartialType com
  skipNullProperties:false; campos omitidos continuam opcionais e null não
  substitui um campo obrigatório.
- Centavos inteiros de 1 a 2147483647, em criação e edição, com defesa também
  nos serviços para chamadas internas. Sem arredondamento monetário adicional; a
  configuração global de conversão implícita da ValidationPipe foi preservada.
- Dia de vencimento inteiro entre 1 e 31; valores nulos continuam permitidos
  nesse campo nullable. Recorrência e isActive rejeitam null e tipos inválidos.
- Texto obrigatório deve conter ao menos um caractere diferente de espaço.
- Roles, tenant autenticado, endpoints e envelopes preservados. Edição somente
  de observações continua aceita. Sem migração ou alteração de dados históricos.

## Verificação

Testes HTTP usam ValidationPipe (incluindo conversão implícita) e RolesGuard reais, com sessão e serviços
simulados. Cobrem criação/edição, limites inclusivos, frações, overflow, strings,
null, campos desconhecidos, enums/datas inválidos, texto vazio e notas isoladas.
Testes diretos dos serviços comprovam que NaN/Infinity e valores inválidos não
chegam à persistência nem à timeline. A suíte não prova concorrência de escrita.

O BFF continua convertendo valores em reais para centavos conforme seu contrato;
a API agora rejeita o resultado inválido. Não houve alteração na forma de cálculo
dos resumos mensais nem nas políticas de despesas recorrentes.

Resultado local: 160 suítes / 1.055 testes da API aprovados, TypeScript, build dos
três pacotes, validador Operating System e `git diff --check` aprovados.
