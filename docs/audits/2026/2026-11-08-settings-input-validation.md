# Validação das configurações administrativas

## Falha encontrada

O DTO de configurações exigia texto não vazio, mas aceitava nome composto apenas por espaços e fuso inexistente. Campos nulos também eram ignorados por `IsOptional`. A tela verificava apenas se o fuso estava preenchido.

## Correção

- Nome e fuso são aparados antes da validação e persistência pelo ValidationPipe.
- Fusos precisam ser reconhecidos pelo runtime e nomeados, como `America/Sao_Paulo` ou `UTC`. Deslocamentos numéricos como `+03:00` são rejeitados.
- Campos opcionais continuam permitindo atualizações parciais, mas valores nulos explícitos são rejeitados.
- A tela valida o fuso, mostra orientação junto ao campo e impede salvar valores inválidos. O envio normaliza os espaços e atualiza o formulário com o texto normalizado.
- O tenant continua derivado exclusivamente da sessão autenticada. Nenhuma integração externa foi modificada.

## Evidências

- 36 testes da área passaram, incluindo 11 testes HTTP com o mesmo ValidationPipe usado em produção. Eles verificam que entradas inválidas não chegam ao serviço de persistência, que o tenant vem da sessão e que atualizações parciais mantêm campos ausentes.
- Suíte geral da API: 739 passaram; 62 foram ignorados conforme configuração existente. Esta execução começou antes da adição dos 11 testes HTTP, executados no recorte posterior.
- Frontend: 85 arquivos e 664 testes passaram, incluindo fusos válidos, inválidos e deslocamentos numéricos.
- Build e typecheck da API e do frontend passaram; lint do frontend e `git diff --check` também passaram.

A validação depende da base de fusos do runtime. Os testes HTTP usam serviço simulado para comprovar a fronteira de validação, sem banco real.
