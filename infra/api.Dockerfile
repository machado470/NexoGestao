FROM node:20-bookworm-slim

# Dependências de runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl wget bash ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Instala deps na raiz (monorepo)
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

# Copia o resto
COPY . .

# Opcional: força engines glibc
ENV PRISMA_CLI_QUERY_ENGINE_TYPE_LIBRARY=1

EXPOSE 3000
