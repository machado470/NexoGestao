FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
  openssl \
  ca-certificates \
  postgresql-client \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm @nestjs/cli

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile

COPY . .

# 🔒 GARANTIA ABSOLUTA que o entrypoint é executável e sem CRLF
RUN chmod +x /app/apps/api/docker-entrypoint.sh \
  && sed -i 's/\r$//' /app/apps/api/docker-entrypoint.sh

RUN pnpm --filter api prisma:generate
RUN pnpm --filter api build

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/main.js"]
