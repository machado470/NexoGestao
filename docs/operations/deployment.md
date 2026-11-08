---
status: review
owner: nexogestao
last_reviewed: 2026-09-06
source_of_truth: true
supersedes:
  - docs/DEPLOYMENT_GUIDE.md
---

# Deployment

Os artefatos executáveis atualmente versionados são `Dockerfile`, `infra/api.Dockerfile`, `docker-compose.staging.yml`, `docker-compose.prod.yml`, `railway.json` e os scripts em `dev/`. Eles prevalecem sobre instruções históricas.

## Gates mínimos antes de promover

```bash
pnpm ci:preflight
pnpm prisma:check
```

Migrations canônicas devem ser aplicadas com `pnpm prisma:migrate:deploy`; não editar migrations já promovidas. Backups e rollback devem ser planejados antes de qualquer alteração de dados.

## Estado da documentação

Este documento permanece em **review**: há mais de um alvo de implantação versionado (Compose e Railway), e a autoridade operacional de produção ainda precisa ser definida. Até essa decisão, valide variáveis contra os arquivos `.env.*.example` e o artefato do ambiente escolhido, sem inferir valores de documentos arquivados.

## Base Compose reproduzível

`docker-compose.prod.yml`, `apps/api/Dockerfile.prod`, `apps/web/Dockerfile.prod`
e `infra/nginx/nginx.prod.conf` definem esta base. O `Dockerfile` raiz continua
sendo o alvo de build do workflow legado de imagem da API; não prova deploy.
Node 24 e pnpm 10.30.3 são usados com lockfile imutável. Tags de imagens base
continuam móveis; esta base não promete builds idênticos byte a byte.

A API escuta em 3000 e o web/BFF em 3010. O BFF usa `http://api:3000` na rede
Compose; `VITE_API_URL` é configuração pública de build. As imagens finais
instalam somente dependências de produção e recebem o pacote comum compilado
(API) e o Prisma Client gerado no build. Vite permanece ferramenta de build;
o bundle do BFF em produção serve arquivos estáticos sem importar Vite.

Migrations usam um alvo separado `builder`, com Prisma CLI e schema; a imagem
runtime não gera código, não compila e não aplica migrations/seeds ao iniciar.
O startup falha quando PostgreSQL não responde ou o smoke canônico do banco falha.

### Configuração e TLS

1. Crie fora do Git um arquivo modo `0600` baseado em `.env.prod.example`.
2. Configure `DATABASE_URL` para o serviço `postgres`, usando percent-encoding
   nas credenciais e nome do banco; a senha `POSTGRES_PASSWORD` contém o valor
   original. Configure `REDIS_URL` para `redis` com senha aleatória URL-safe.
3. Configure `DOMAIN` como hostname DNS simples (sem protocolo, porta ou path).
   Providencie `fullchain.pem` e `privkey.pem` no diretório absoluto `TLS_CERT_DIR`.
   O certificado deve cobrir domínio raiz, `app.DOMAIN` e `api.DOMAIN`.
4. `HTTP_BIND`/`HTTPS_BIND` usam loopback por padrão, em 8080/8443. Portas públicas,
   firewall, DNS e certificados reais dependem do destino ainda não identificado.

Nginx usa o mecanismo de templates da imagem oficial, substituindo apenas
`DOMAIN`. Variáveis nativas como `$host` e `$request_uri` são preservadas.
O perfil `certificates` é opcional e apenas renova certificados já provisionados;
a emissão, a cópia para `TLS_CERT_DIR` e o reload do Nginx são responsabilidade
operacional explícita. Não habilite esse perfil como solução automática de TLS.

### Sequência a revisar para um destino autorizado

Os comandos abaixo são procedimento, não autorização para produção:

```bash
export NEXO_ENV_FILE=/absolute/path/outside/git/compose.env
compose=(docker compose --env-file "$NEXO_ENV_FILE" -f docker-compose.prod.yml)
"${compose[@]}" config --quiet
# config completo contém segredos: revisar somente em terminal protegido.
"${compose[@]}" build api web migrate
"${compose[@]}" up -d --wait postgres redis
# Somente após backup, destino e janela aprovados:
"${compose[@]}" run --rm migrate
"${compose[@]}" up -d --wait api web nginx
"${compose[@]}" exec -T nginx nginx -t
```

Defina um nome de projeto Compose estável para o destino: volumes são isolados
por projeto. Antes de trocar de um deployment existente, inventarie os volumes
reais e fixe o mapeamento; não presuma que novos volumes contêm dados anteriores.
Nunca use `down --volumes` em dados reais. Rollback da aplicação exige conferir
compatibilidade do schema; rollback de dados não é automatizado por esta base.

### Prova descartável e CI

```bash
bash scripts/smoke-production-compose.sh --config-only
bash scripts/smoke-production-compose.sh
```

O segundo comando constrói ambas as imagens e o alvo de migrations, cria projeto,
volumes, portas locais aleatórias e TLS autoassinado exclusivos, aplica migrations
somente nesse banco e valida health, HTML, redirect e módulos runtime. O cleanup
remove somente os recursos desse projeto. Requer Docker Compose v2, Node, curl
e OpenSSL. Em ambiente cloud, `CODEX_PROXY_CERT`, quando disponível, entra como
build secret; TLS permanece verificado. Não executar builds completos se o
armazenamento VFS disponível for insuficiente.

`Production Compose validation` executa essa prova em PRs e na main, sem push de
imagens ou deploy. `Staging deployment status` é manual e falha explicitamente
porque o destino não está configurado. Nenhum desses workflows prova produção.
