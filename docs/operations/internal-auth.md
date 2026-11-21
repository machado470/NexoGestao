# Autenticação interna BFF → API (C7.2d)

A C7.2d prova à API que uma requisição foi produzida pelo BFF que conhece uma chave
compartilhada. **Ela não comprova a identidade nem o IP do usuário final**: a identidade continua
sendo o JWT, e o IP do cliente continua não verificado (`NO_TRUST`, ver `client-ip-chain.md`).
Nesta fase o resultado é **somente observado**: nenhum guard, throttler ou decisão de autorização
o consulta. Os limites de rate limiting não mudaram.

## Protocolo v1

Cabeçalho: `X-Nexo-Internal-Auth: v1.<kid>.<ts>.<nonce>.<sig>`

| Campo | Formato | Uso |
|---|---|---|
| `kid` | `[A-Za-z0-9_-]{1,32}` | Identifica a chave (rotação) |
| `ts` | 10 dígitos (segundos Unix) | Janela de ±30 s |
| `nonce` | 22 caracteres base64url (16 bytes aleatórios) | Uso único |
| `sig` | 43 caracteres base64url | HMAC-SHA256 da string canônica |

String canônica (os campos não podem conter quebra de linha, então é inequívoca):

```
NEXO-INTERNAL-AUTH\nv1\n<kid>\n<ts>\n<nonce>\n<MÉTODO>\n<request-target>\n<sha256(corpo) hex>
```

- `request-target`: caminho + query exatamente como enviados (o `originalUrl` do Express).
- Corpo: o texto JSON enviado; sem corpo = string vazia. Corpos que não são texto não são assinados.
- Verificação na ordem: formato → `kid` → janela de tempo → assinatura (tempo constante) → nonce.
  O nonce só é consumido depois de uma assinatura válida, então ninguém consegue "queimar" nonces.
- Nonce: `SET NX PX 90000` no Redis existente, chave
  `nexogestao:<NODE_ENV>:internal-auth:v1:nonce:<sha256(kid|nonce)>` (o nonce não é gravado em
  claro). 90 s cobre a janela inteira de aceitação (2 × 30 s) com folga.
- Redis indisponível, assinatura inválida, expirada, futura, `kid` desconhecido ou repetida:
  o contexto interno é tratado como **ausente**. Nunca há privilégio adicional e a requisição
  segue exatamente como antes.
- Os dois lados implementam a mesma canonicalização; as suítes da API e do BFF verificam o mesmo
  vetor conhecido.

## O que é registrado

- API: uma linha por janela de 15 min com tráfego, só contagens por resultado:
  `{"level":"info","message":"internal_auth_summary","event":"internal_auth_summary","mode":"observe","statuses":{...}}`.
  Resultados possíveis: `missing`, `malformed`, `unknown_kid`, `expired`, `future`,
  `bad_signature`, `replay`, `replay_check_unavailable`, `valid:<kid>`. No Railway:
  filtro `@event:internal_auth_summary`.
- Boot da API: `Autenticação interna BFF→API em modo observe (N chave(s); ...)`.
- Boot do web: `[web] internal auth signing=enabled kid=<kid>` ou `signing=disabled`.
- Nunca: chave, assinatura, nonce, cookie, token, `Authorization` ou IP.

## Variáveis (nenhuma é configurada pelo código nem por este PR)

| Serviço | Variável | Valores | Padrão |
|---|---|---|---|
| API | `NEXO_INTERNAL_AUTH_MODE` | `off` \| `observe` | `off` |
| API | `NEXO_INTERNAL_AUTH_KEYS` | `kid:base64[,kid:base64]` (até 3, ≥ 32 bytes cada) | — (obrigatória em `observe`) |
| Web | `NEXO_INTERNAL_AUTH_SIGNING` | `true` \| `false` | `false` |
| Web | `NEXO_INTERNAL_AUTH_KEY_ID` | `[A-Za-z0-9_-]{1,32}` | — (obrigatória com signing) |
| Web | `NEXO_INTERNAL_AUTH_SECRET` | base64 ≥ 32 bytes | — (obrigatória com signing) |

Valores inválidos impedem o boot do serviço afetado (o deploy falha no healthcheck e a versão
anterior continua no ar). A chave é **própria**: nunca reutilizar `JWT_SECRET`. Gerar fora do
repositório, por exemplo `openssl rand -base64 48`, e cadastrar só no Railway.

## Ativação segura (feita pelo operador, fora deste PR)

1. Gerar a chave e escolher um `kid` (por exemplo `k2026a`).
2. **API primeiro:** `NEXO_INTERNAL_AUTH_KEYS=k2026a:<chave>` e `NEXO_INTERNAL_AUTH_MODE=observe`.
   A API aceita requisições assinadas e não assinadas da mesma forma; os resumos mostram `missing`.
3. **Depois o web:** `NEXO_INTERNAL_AUTH_KEY_ID=k2026a`, `NEXO_INTERNAL_AUTH_SECRET=<mesma chave>`,
   `NEXO_INTERNAL_AUTH_SIGNING=true`.
4. Acompanhar `@event:internal_auth_summary`: esperado `valid:k2026a` dominante. `missing`
   residual vem de chamadas que não passam pelo BFF (webhooks, healthchecks, acesso direto).
   `bad_signature` contínuo indica chave divergente ou URL de API com prefixo diferente do assinado;
   `replay_check_unavailable` indica Redis indisponível; `expired`/`future` indicam relógio.
5. Só a C7.2e poderá usar o resultado, sempre com exceções para webhooks e healthchecks.

## Rotação

1. API: `NEXO_INTERNAL_AUTH_KEYS=k2026b:<nova>,k2026a:<antiga>` (as duas valem).
2. Web: trocar `KEY_ID`/`SECRET` para `k2026b`.
3. Confirmar `valid:k2026b` nos resumos; então remover `k2026a` da API.

## Rollback (independente por serviço, sem enfraquecer a segurança)

- Web: `NEXO_INTERNAL_AUTH_SIGNING=false` → requisições voltam a sair sem assinatura.
- API: `NEXO_INTERNAL_AUTH_MODE=off` → o middleware não faz nada e nenhuma conexão Redis extra é aberta.
- Como nada depende do resultado nesta fase, qualquer combinação (assinando/não assinando,
  off/observe) mantém o comportamento atual. Nenhum rollback passa a confiar em cabeçalhos ou IPs.
