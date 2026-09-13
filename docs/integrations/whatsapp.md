---
status: review
owner: nexogestao
last_reviewed: 2026-09-06
source_of_truth: true
supersedes:
---

# WhatsApp: provider e associação de tenant

## Objetivo

Deixar a API pronta para envio real via Z-API em ambiente local, exigindo apenas preencher as chaves no `.env`.

## Variáveis obrigatórias (quando `WHATSAPP_PROVIDER=zapi`)

```env
WHATSAPP_PROVIDER=zapi
ZAPI_INSTANCE_ID=
ZAPI_TOKEN=
ZAPI_CLIENT_TOKEN=
```

## Comportamento esperado

- Se `WHATSAPP_PROVIDER=zapi` e faltar alguma chave, a API **sobe normalmente**.
- A readiness (`GET /health/readiness`) marca WhatsApp como `misconfigured` e lista `missingEnv`.
- O provider loga aviso claro com as variáveis faltantes.
- Falhas fatais de autenticação/assinatura da Z-API não entram em loop infinito de requeue: a mensagem é marcada como `FAILED`.

## Diagnóstico rápido

- `GET /health/readiness`
  - `integrations.whatsapp`:
    - `configured` (zapi pronto)
    - `misconfigured` (zapi selecionado com chave faltante)
    - `configured_mock` (provider mock)
  - `whatsapp.missingEnv`: lista do que falta no `.env`

## Subida local

```bash
cp .env.example .env
pnpm install
pnpm --filter ./apps/api build
pnpm --filter ./apps/api dev
```

## Provisionamento obrigatório para webhooks

As credenciais configuram o envio, mas **não autorizam um tenant**. Antes de liberar o webhook público,
um operador com acesso administrativo ao banco deve associar a conta externa a uma organização conhecida:

```bash
pnpm whatsapp:provision-account -- --provider meta_cloud --account-id "$META_PHONE_NUMBER_ID" --org-slug cliente-confirmado
# ou, se o UUID da organização foi conferido:
pnpm whatsapp:provision-account -- --provider meta_cloud --account-id "$META_PHONE_NUMBER_ID" --org-id UUID_CONFIRMADO
```

Para Meta Cloud, `account-id` é o **Phone Number ID** exibido no painel Meta e configurado em
`META_PHONE_NUMBER_ID` (não é o número de telefone visível). Para Z-API, é o `ZAPI_INSTANCE_ID`.
`provider` deve ser exatamente `meta_cloud`, `zapi` ou `mock`.

O comando exige exatamente `--org-id` ou `--org-slug`, confirma que a organização existe e faz upsert
idempotente. Uma reexecução para a mesma organização é segura; se `provider/account-id` já pertencer a
outra organização, o comando falha e nunca troca o ownership. Ele não consulta payload, headers, primeira
organização ou tenant default.

> **Limitação atual da entrada Z-API:** o webhook público só extrai identidade de conta dos payloads
> `meta_cloud` (e `mock` de desenvolvimento). Portanto, cadastrar `zapi/ZAPI_INSTANCE_ID` prepara o
> ownership, mas webhooks Z-API continuam indisponíveis até existir um identificador de conta assinado e
> extraível no adapter, sem confiar em campos livres. Não habilite callback inbound Z-API antes disso.

### Checklist por ambiente

- **dev:** nenhum mapping é necessário se webhooks não forem exercitados; fixtures/testes criam mappings
  isolados. Para callbacks locais, use o comando com a organização de desenvolvimento explícita.
- **staging e piloto:** migrations e seed não atribuem contas reais automaticamente. Execute o comando
  após confirmar a organização e antes de apontar o callback do provider.
- **produção:** faça inventário de cada Phone Number ID/instância e organização proprietária, execute uma
  vez por conta e valide a associação antes de liberar tráfego. Bancos existentes ficam sem mapping até
  esse passo manual; nesses bancos o webhook falhará explicitamente, sem fallback para outro tenant.
