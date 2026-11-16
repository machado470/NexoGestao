# Clareza e identificação dos formulários financeiros — 12/11/2026

Base `5893b0aa`, branch `fix/cobranca-clareza-e-rotulos`, raiz `/workspace/NexoGestao`, início limpo, sem AGENTS.md aplicável. README/manifests, criação de cobrança, financeiro e contratos consultados. PR #1061 integrado com os três checks aprovados.

## Achados e correções

`CreateChargeModal` oferecia “Cobrança recorrente” com a descrição “Mantém padrão mensal com vencimento previsível”, mas o submit enviava somente uma cobrança avulsa (customerId, amountCents, dueDate, notes, idempotencyKey), sem contrato/agenda de recorrência. A opção agora aparece como **Recorrência (indisponível)**, desabilitada e com explicação de que a criação atual gera cobranças avulsas. Não foi inventado agendamento mensal. Modos manual/serviço mantidos; estado de seleção exposto por aria-pressed.

O navegador também confirmou campos sem associação com seus rótulos. `apps/web/client/src/components/CreateChargeModal.tsx` usa useId por instância e associa cliente, valor, vencimento, referência e observações. Preserva aria-label existente do valor. `apps/web/client/src/pages/FinancesPage.tsx` associa o filtro de status e completa o id ausente do seletor de método, cujo label já apontava para payment-method. Valor/motivo de cancelamento já possuíam associação válida e foram verificados.

Não altera API, idempotência, valores, cancelamento, planos ou cobrança de assinatura. “Ligada a serviço” mantém seu comportamento de referência textual nas notas; não se declarou novo vínculo estruturado de O.S.

## Evidências

- [DOM antes](charge-form-evidence/before.json) e [ensaio inicial](charge-form-evidence/before.txt): criação manual tinha controles sem id/rótulo associado. A oferta de recorrência e o payload avulso foram confirmados no código atual antes da correção.
- **806 testes web / 100 arquivos passaram.** [Log](charge-form-evidence/tests.txt).
- Typecheck, lint:os, build web e diff --check passaram. [Tipos](charge-form-evidence/types.txt), [lint](charge-form-evidence/lint.txt), [build](charge-form-evidence/build.txt). PNPM 10.30.3 via npx.
- Chromium + API/BFF/PostgreSQL reais: oito inspeções em 1440/390 px (criação manual, contexto de serviço, modal de pagamento e cancelamento) confirmaram controles com id/nome associado, IDs únicos no modal e ausência de overflow horizontal da página. Recorrência estava desabilitada. [Resultado](charge-form-evidence/browser.json), [execução](charge-form-evidence/browser.txt).
- Em cada largura, cobrança avulsa de R$85,50 criada pela interface, recarregada e cancelada com motivo pelo modal. PostgreSQL confirmou CANCELED, amountCents=8550 e zero pagamentos. Não se registrou pagamento nesta etapa; o modal de pagamento foi aberto e fechado para inspeção.
- Capturas 390 px: [manual](charge-form-evidence/manual-390.png), [serviço](charge-form-evidence/service-390.png), [pagamento](charge-form-evidence/payment-390.png), [cancelamento](charge-form-evidence/cancel-390.png).

A harness foi ajustada para escolher o botão de submissão no footer entre os dois “Apenas criar” (opção e submit); não era falha do produto. A execução final completou todas as verificações.

## Dados e limites

Organização/ADMIN verificado/pessoa/cliente fictícios preparados; cobranças criadas e canceladas pelos pontos de entrada visuais. Fixtures e relações removidas por orgId exclusivo, serviços/containers locais encerrados e volumes preservados. Sem PIX real, checkout, mensagens, e-mail ou provedor externo. Harness temporária com credenciais fictícias não versionada. Nenhum deploy.

Recorrência continua sem implementação; só sua oferta enganosa foi corrigida. As inspeções não substituem leitor de tela ou teclado nativo real. AU08/AU11/AU12 seguem parciais pelas dependências já registradas. Não se repetiram testes API, cujos fontes e contratos não mudaram.
