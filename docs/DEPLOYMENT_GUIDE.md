# Guia de Deploy de Produção

Este guia fornece as instruções passo a passo para realizar o deploy do NexoGestão em um ambiente de produção.

## 1. Pré-requisitos

- Um servidor Linux (Ubuntu 22.04 recomendado) com acesso root/sudo.
- **Docker** e **Docker Compose** instalados.
- **Git** instalado.
- Um **domínio** configurado para apontar para o IP do seu servidor.
- Portas `80` e `443` abertas no firewall do servidor.

## 2. Configuração Inicial do Servidor

1.  **Clonar o Repositório**:

    ```bash
    git clone https://github.com/seu-usuario/nexogestao.git
    cd nexogestao
    ```

2.  **Criar o Arquivo de Variáveis de Ambiente**:

    Copie o arquivo de exemplo e preencha **TODAS** as variáveis. Preste atenção especial às senhas e chaves secretas.

    ```bash
    cp examples/env/.env.prod.example .env.prod
    nano .env.prod
    ```

    **Variáveis Críticas**:
    - `DOMAIN`: Seu domínio de produção (ex: `app.nexogestao.com.br`).
    - `POSTGRES_PASSWORD`: Senha forte para o banco de dados.
    - `REDIS_PASSWORD`: Senha forte para o Redis.
    - `JWT_SECRET`: Uma string aleatória e muito longa (64+ caracteres).
    - `STRIPE_*`: Suas chaves de API do Stripe (modo *live*).
    - `SENTRY_DSN`: DSN do seu projeto Sentry.

## 3. Geração do Certificado SSL (Let's Encrypt)

Vamos usar o Certbot com o Nginx para obter um certificado SSL gratuito.

1.  **Primeiro Deploy (Apenas Nginx e Certbot)**:

    Inicie apenas os serviços necessários para o desafio do Certbot.

    ```bash
    docker compose -f docker-compose.prod.yml up -d nginx certbot
    ```

2.  **Executar o Certbot**:

    Substitua `app.nexogestao.com.br` pelo seu domínio.

    ```bash
    docker compose -f docker-compose.prod.yml run --rm certbot certonly \
      --webroot -w /var/www/certbot \
      -d app.nexogestao.com.br \
      --email seu-email@dominio.com \
      --agree-tos \
      --no-eff-email
    ```

3.  **Verificar Renovação**:

    O contêiner `certbot` já está configurado para renovar o certificado automaticamente. Após a primeira execução, você pode parar o Nginx temporariamente.

    ```bash
    docker compose -f docker-compose.prod.yml stop nginx
    ```

## 4. Deploy Completo da Aplicação

1.  **Build e Start dos Serviços**:

    Agora, suba todos os serviços em modo de produção. O Docker Compose irá construir as imagens da `api` and `web` e iniciar todos os contêineres na ordem correta.

    ```bash
    docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d
    ```

2.  **Executar a Migração do Banco de Dados**:

    Com a API em execução, execute o comando `prisma migrate deploy` para aplicar todas as migrações e preparar o schema do banco de dados.

    ```bash
    docker compose -f docker-compose.prod.yml exec api pnpm prisma:migrate:deploy
    ```

3.  **Verificar os Logs**:

    Monitore os logs para garantir que todos os serviços iniciaram sem erros.

    ```bash
    docker compose -f docker-compose.prod.yml logs -f
    ```

    Você deve ver mensagens indicando que a API, o Web, o Postgres e o Redis estão saudáveis.

4.  **Acessar a Aplicação**:

    Acesse `https://seu-dominio.com` no navegador. A aplicação deve estar online e funcionando.

## 5. Manutenção e Atualizações

-   **Atualizar a Aplicação**: Para aplicar novas atualizações do código, puxe as mudanças do Git e rode o comando de deploy novamente:

    ```bash
    git pull origin main
    docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d
    ```

-   **Backup e Restore**: Os scripts `scripts/backup-db.sh` e `scripts/restore-db.sh` estão disponíveis para backup e restauração do banco de dados. Um cron job para backup automático é configurado em `infra/cron/nexogestao-backup.cron`.

-   **Smoke Test**: Após um deploy, execute o smoke test para garantir que as funcionalidades críticas estão operacionais:

    ```bash
    ./scripts/smoke-e2e.sh https://seu-dominio.com/api admin@nexo.com SuaSenha
    ```
