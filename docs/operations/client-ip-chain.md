# Identidade de IP e cadeia de proxies (C7.2c → C7.2e)

Estado em C7.2c: **somente observação**. Nenhum proxy é considerado confiável e nenhum IP é usado
em rate limiting, autenticação ou autorização. A API continua sem `trust proxy` e contando
anônimos pelo endereço da conexão (o BFF), exatamente como na C7.1.

## O que foi entregue na C7.2c

- `apps/web/server/_core/clientIp.ts`: observação pura da requisição no BFF (endereço da conexão,
  `X-Forwarded-For`, `X-Real-IP`, número e formato dos saltos, IPv4/IPv6/IPv4 mapeado, escopo
  loopback/privado/link-local/público) com classificação `verified` / `unverified` / `invalid`.
  A política de produção é `NO_TRUST`: nada é `verified`. O candidato não verificado nunca é o
  primeiro valor do `X-Forwarded-For` (escolhido pelo cliente): é o salto mais próximo (à direita),
  depois o `X-Real-IP`, depois o endereço da conexão.
- Métricas agregadas em memória com dimensões fixas e cardinalidade limitada (512 formatos, 50 no
  resumo). Uma linha `client_ip_chain_summary` a cada 15 min, só com contagens: sem IP, sem hash,
  sem token, cookie ou `Authorization`. Não há correlação entre requisições, então não há hash de IP.
- Diagnóstico `system.clientIpDiagnostic` (tRPC): só para operadores da plataforma, decididos pela
  API (`GET /v1/admin/platform-access`: sessão verificada, `ADMIN` ativo e id em
  `PLATFORM_ADMIN_USER_IDS`; lista vazia nega todos). Mostra apenas a própria requisição: formato
  da cadeia, endereços públicos (o próprio e os de proxies públicos) e `<private>` para os
  internos, mais os contadores agregados.
- Consentimento LGPD: o cookie deixa de guardar IP e o registro de auditoria grava `ip: null`
  enquanto a origem não for verificada (sempre, com `NO_TRUST`), com `ipVerified: false` e
  `ipVerification` (`unverified` ou `invalid`). O evento, a data, o identificador e as preferências
  continuam iguais. O registro só é escrito no log (`logger.audit`, JSON); não há leitor no
  repositório, e registros anteriores não são alterados. Na C7.2e, com origem verificada, o mesmo
  campo passa a receber o IP.

## O que ainda precisa ser confirmado no Railway

1. Se `NEXO_API_URL` do serviço web aponta para a rede privada (`*.railway.internal`) ou para um
   domínio público da API.
2. Se a API tem domínio público (necessário para webhooks Stripe/WhatsApp) e quem o usa.
3. Como a borda do Railway trata `X-Forwarded-For`: sobrescreve ou acrescenta; quantos saltos
   existem entre a borda e o BFF; se envia `X-Real-IP`; de que faixa vem a conexão com o BFF.
4. Quantas réplicas web e API existem (cada réplica do BFF tem endereço próprio).

## Como validar a cadeia com segurança

1. Publicar a C7.2c. Nada muda no comportamento.
2. Ler os resumos `client_ip_chain_summary` por alguns dias. Esperado numa borda única que
   acrescenta: `unverified|forwarded-for|hops=1|…|peer=…/private|last=public` dominante.
   `hops=2+` com o primeiro valor variando indica clientes enviando `X-Forwarded-For` próprio.
3. Um operador da plataforma abre o diagnóstico pelo navegador normal e compara o último endereço
   público da cadeia com o próprio IP público (por exemplo, o informado pelo provedor de internet).
4. Testes com `X-Forwarded-For` forjado só em um ambiente de staging do Railway, nunca em produção.
5. Registrar a evidência (formato da cadeia, faixa do peer, número de saltos) antes da C7.2d.

Só com essa evidência se define a política `trustPolicyFrom(<faixas da borda>, <saltos>)`.

## C7.2d — assinatura BFF → API (planejamento)

- Cabeçalho `X-Nexo-Client-Context: v1.<kid>.<ts>.<nonce>.<ipB64>.<mac>`; `mac` =
  HMAC-SHA256(`v1|kid|ts|nonce|ip|MÉTODO|rota|requestId`) com segredo **próprio** (nunca o
  `JWT_SECRET`), ≥ 32 bytes, gerado pelo operador no Railway.
- O HMAC autentica o BFF; não prova o IP. O IP só vai no cabeçalho se for `verified` pela política
  baseada em evidência; caso contrário vai `unverified` (ou é omitido) e a API trata como hoje.
- O BFF remove qualquer `x-nexo-*` recebido e grava o seu por último, nos quatro pontos de `fetch`
  (`nexoClient.ts`, `context.ts`, `oauth.ts`, `notificationStream.ts`).
- API: `CLIENT_CONTEXT_MODE=off|observe|enforce`; `NEXO_INTERNAL_HMAC_KEYS` com chave atual e
  anterior (rotação: adicionar na API → trocar no BFF → remover a antiga); janela ±30 s;
  comparação em tempo constante.

### Replay sem aceitar assinaturas não verificadas quando o Redis falha

- Nonce de uso único com `SET NX PX 60000` no Redis existente, prefixo próprio.
- Se o Redis não responder, a assinatura **não** é aceita como verificada: o contexto é tratado
  como ausente (a requisição segue com a identidade atual, o endereço da conexão), registra-se uma
  métrica `client_context_replay_check_unavailable` e nada é bloqueado por isso. Assim, uma queda
  do Redis nunca transforma um cabeçalho possivelmente repetido em IP confiável, nem derruba
  usuários.

## C7.2e — migração dos limites anônimos sem bloqueios coletivos

1. Modo `shadow`: calcular os novos limites por (conta + IP verificado) e por IP verificado, e só
   contar "teria bloqueado"; os limites atuais continuam valendo.
2. Ajustar limites com os dados reais; manter o teto anônimo global atual apenas como disjuntor
   para requisições sem IP verificado.
3. `enforce` gradual por rota (primeiro rotas públicas de leitura, por último credenciais).
4. Pagamentos, idempotência e limites autenticados não mudam.

## Rollback sem enfraquecer a segurança

- C7.2c: reverter o commit; não há estado persistido nem variável nova.
- C7.2d: `CLIENT_CONTEXT_MODE=off` na API, independente do BFF; o BFF pode continuar assinando.
- C7.2e: voltar a `observe`/`off`; os limites atuais (por endereço da conexão) voltam a valer.
- Em nenhum caso o rollback passa a confiar em cabeçalhos: o estado de volta é sempre o atual
  (endereço da conexão, sem `trust proxy`).
