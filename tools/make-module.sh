#!/usr/bin/env bash
set -e

MODULE_NAME=$1

if [ -z "$MODULE_NAME" ]; then
  echo "Uso correto: sh tools/make-module.sh nome-do-modulo"
  exit 1
fi

LOWER=$(echo "$MODULE_NAME" | tr '[:upper:]' '[:lower:]')
CAMEL=$(echo "$MODULE_NAME" | sed -r 's/(^|-)([a-z])/\U\2/g')

echo ">> Criando módulo: $MODULE_NAME"

# FRONTEND -----------------------------------------------------------------------
echo ">> Criando estrutura frontend..."
mkdir -p apps/site/src/app/$LOWER
mkdir -p apps/site/src/components/$LOWER

# PAGE
cat <<EOF > apps/site/src/app/$LOWER/page.tsx
export default function ${CAMEL}Page() {
  return (
    <div>
      <h1>$CAMEL</h1>
      <p>Página inicial do módulo $MODULE_NAME.</p>
    </div>
  );
}
EOF

# COMPONENT BASE
cat <<EOF > apps/site/src/components/$LOWER/Card.tsx
export function ${CAMEL}Card() {
  return (
    <div className="p-4 border rounded">
      <h2>Card $CAMEL</h2>
    </div>
  );
}
EOF

# BACKEND ------------------------------------------------------------------------
echo ">> Criando estrutura backend..."

mkdir -p apps/api/src/$LOWER

# SERVICE
cat <<EOF > apps/api/src/$LOWER/${LOWER}.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class ${CAMEL}Service {
  findAll() {
    return ['${MODULE_NAME} OK'];
  }
}
EOF

# CONTROLLER
cat <<EOF > apps/api/src/$LOWER/${LOWER}.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ${CAMEL}Service } from './${LOWER}.service';

@Controller('$LOWER')
export class ${CAMEL}Controller {
  constructor(private readonly service: ${CAMEL}Service) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
EOF

# MODULE
cat <<EOF > apps/api/src/$LOWER/${LOWER}.module.ts
import { Module } from '@nestjs/common';
import { ${CAMEL}Controller } from './${LOWER}.controller';
import { ${CAMEL}Service } from './${LOWER}.service';

@Module({
  controllers: [${CAMEL}Controller],
  providers: [${CAMEL}Service],
})
export class ${CAMEL}Module {}
EOF

# UDPATE APP MODULE
echo ">> Atualizando AppModule automaticamente..."

APP_MODULE=apps/api/src/app.module.ts

# Import
if ! grep -q "${CAMEL}Module" "$APP_MODULE"; then
  sed -i "s|imports: \[|imports: [\n    ${CAMEL}Module,|" "$APP_MODULE"
  sed -i "1s|^|import { ${CAMEL}Module } from './$LOWER/${LOWER}.module';\n|" "$APP_MODULE"
fi

# PRISMA MODEL -------------------------------------------------------------------
echo ">> Atualizando Prisma..."

PRISMA=apps/api/prisma/schema.prisma

if ! grep -q "model ${CAMEL}" "$PRISMA"; then
cat <<EOF >> $PRISMA

model ${CAMEL} {
  id        Int      @id @default(autoincrement())
  name      String
  createdAt DateTime @default(now())
}
EOF
fi

echo ">> Rodando migrations..."
docker compose exec api pnpm prisma:generate
docker compose exec api pnpm prisma:push

echo ">> Módulo $CAMEL criado com sucesso!"
