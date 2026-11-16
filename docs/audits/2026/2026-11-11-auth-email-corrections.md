# Correções da entrada e recuperação de acesso — 11/11/2026

Base `68fbf1ff1fcb480b4370091dc3ef7e74f65f7caf`, branch `fix/auth-email-e-validacao`. A auditoria e suas evidências existentes foram preservadas. Alterações locais para revisão, sem commit, push, deploy ou migration. Esta etapa trata AU05/AU09/AU10; os outros dez achados da [auditoria das oito áreas](2026-11-11-eight-area-audit.md) permanecem pendentes.

## Resultado

| Achado | Estado | Alteração |
| --- | --- | --- |
| AU05 — e-mail rejeitado tratado como enviado | Corrigido em código e testes | Envio exige resposta sem `error` e recibo com ID; rejeição retornada, ausência de recibo e exceção não produzem `sent` no cadastro. Recuperação/reenvio reconhecem a solicitação, sem afirmar envio ou entrega. Falhas individuais ficam no log por código fixo, sem corpo do provedor, links ou tokens. |
| AU09 — entradas de autenticação sem contrato em runtime | Corrigido | DTOs concretos para cadastro, login, recuperação, reset, verificação e reenvio. Validam tipos originais, formato e tamanhos; nomes/e-mail são aparados e senhas preservam seus espaços. Compatibilidade com senhas antigas curtas foi mantida no login da API. |
| AU10 — indisponibilidade distingue endereço cadastrado | Corrigido para o cenário auditado | Ausência global de provedor é verificada antes de consultar usuários: endereço existente ou inexistente recebe o mesmo 503. Com provedor configurado, aceitação, rejeição e exceção produzem o mesmo reconhecimento público da solicitação, inclusive em falha de persistência do token. Não há afirmação de tempo constante ou eliminação de todos os canais laterais. |

O campo `success:true` em recuperação/reenvio significa que a **solicitação foi recebida**, não que o provedor aceitou ou entregou uma mensagem. O texto foi atualizado na API e na interface. A ausência global de provedor é um erro, mantém o formulário disponível e não aparece como confirmação verde de envio. Cadastro continua preservando a conta criada e informando `failed` ou `provider_unavailable`, sem abrir sessão quando a confirmação é obrigatória.

## Falha adicional encontrada no navegador

A validação de uma conta nova com confirmação obrigatória revelou que a rota de login recriava componentes a cada atualização do contexto. O estado local com o botão de reenvio desaparecia depois do erro de e-mail não confirmado. As rotas de autenticação agora são criadas uma vez e usam um componente estável por página. O navegador confirmou que o botão permanece acessível, a rejeição do reenvio é exibida e não há promessa falsa de entrega nem erro de página.

## Arquivos

- [DTOs](../../../apps/api/src/auth/dto/auth-request.dto.ts), [AuthController](../../../apps/api/src/auth/auth.controller.ts) e [AuthService](../../../apps/api/src/auth/auth.service.ts).
- [Regressões de entrega e privacidade](../../../apps/api/src/auth/auth-email-delivery.spec.ts), [fronteiras HTTP](../../../apps/api/src/auth/auth-input.http.spec.ts).
- [Rotas estáveis](../../../apps/web/client/src/App.tsx), [login/reenvio](../../../apps/web/client/src/pages/Login.tsx), [recuperação](../../../apps/web/client/src/pages/ForgotPasswordPage.tsx).

A API habilita `enableImplicitConversion` globalmente. Os DTOs consultam as propriedades originais para que números não se convertam silenciosamente em nomes, senhas ou tokens válidos. O teste HTTP usa a mesma configuração da aplicação. Há limites de 254 caracteres para e-mail, 160 para nomes, 256 para tokens e 1.024 para senha; o limite inferior atual de cadastro/reset continua oito caracteres. Não se alterou hash, expiração ou consumo de tokens, critérios de sessão, plano ou permissão.

## Evidências

- **2.011 testes passaram** na suíte consolidada (API 1.209, web 798, common 4); 110 integrações da API permaneceram desabilitadas por seus opt-ins. [Log completo](auth-fix-evidence/tests.txt).
- **36 regressões novas** cobrem entradas inválidas, conversão implícita, espaços em senhas, cadastro com e-mail obrigatório, resposta de rejeição do SDK, ausência de recibo, exceção, indisponibilidade uniforme, conta verificada/ausente e falha privada de persistência. Fazem parte da suíte consolidada.
- API compilada com PostgreSQL/Redis reais e confirmação obrigatória: cadastro persistido sem emissão de sessão; entrada inválida retorna 400; recuperação/reenvio retornam 503 para os dois tipos de endereço; confirmação, reset, consumo único do token, rejeição da sessão antiga e login com senha nova passaram. [Resultado](auth-fix-evidence/http-flow.json).
- **Limite desse fluxo:** sem provedor externo, hashes de tokens de confirmação/reset foram preparados diretamente apenas na conta fictícia criada para o ensaio. Não foi uma prova de entrega de e-mail. A conta e os registros próprios foram removidos ao terminar; dados compartilhados foram preservados.
- Chromium mobile 390×844, interface → BFF → API → PostgreSQL: cadastro normal, redirecionamento correto, login não confirmado, botão de reenvio persistente, erro de indisponibilidade visível, recuperação sem falso sucesso e formulário disponível para nova tentativa. Nenhum erro de página. [Resultado](auth-fix-evidence/browser.json), [reenvio](auth-fix-evidence/resend-unavailable-mobile.png), [recuperação](auth-fix-evidence/recovery-unavailable-mobile.png).
- [Build](auth-fix-evidence/build.txt), [tipos](auth-fix-evidence/typecheck.txt), [lint Operating System](auth-fix-evidence/lint.txt) e `git diff --check` passaram. Usado PNPM 10.30.3. O comando de lint direto é o validador real do projeto; o wrapper agregado não foi reexecutado nesta etapa.

## Limites e próximos itens

Confirmação de aceite pelo provedor não prova entrega na caixa postal. Continuam pendentes sandbox/conta de teste de e-mail, bounce/spam, medições de diferenças de tempo entre contas e diagnóstico operacional externo. As rotinas preservam a persistência do token antes do envio e sua expiração; esta etapa não implementa uma outbox de e-mail ou fila de reenvio durável. Uma chamada ao provedor que não termina ainda depende dos timeouts existentes da infraestrutura; não se adicionou cancelamento/timeout próprio do SDK.

A próxima prioridade são AU01/AU02/AU07 (estado da assinatura, ordenação dos eventos e estorno), seguida de AU03/AU04 (autoridade comercial) e AU06 (revogação do stream). Nada desta etapa corrige ou publica esses itens por implicação.
