#!/usr/bin/env bash

set -e

MODULE=$1

if [ -z "$MODULE" ]; then
  echo "Uso: sh tools/make-crud.sh nome_do_modulo"
  exit 1
fi

echo ">> Gerando CRUD para: $MODULE"

# FRONTEND -------------------------------------------------------------------------------------------------
FRONT_DIR="apps/site/src/app/$MODULE"
COMP_DIR="apps/site/src/components/$MODULE"

mkdir -p $FRONT_DIR
mkdir -p $COMP_DIR

# page.tsx -------------------------------------------------------------------------------------------------
cat << 'EOF' > $FRONT_DIR/page.tsx
export default function Page() {
  return (
    <div className="p-10 text-white">
      <h1 className="text-3xl font-bold">Página: MODULE_NAME</h1>
    </div>
  );
}
EOF

# Card.tsx -------------------------------------------------------------------------------------------------
cat << 'EOF' > $COMP_DIR/Card.tsx
export function CardMODULE() {
  return (
    <div className="rounded-lg p-4 bg-neutral-800 text-white">
      <h2 className="font-bold">Card MODULE_NAME</h2>
    </div>
  );
}
EOF

# BACKEND --------------------------------------------------------------------------------------------------
API_DIR="apps/api/src/$MODULE"
mkdir -p $API_DIR

# module.ts ------------------------------------------------------------------------------------------------
cat << EOF > $API_DIR/${MODULE}.module.ts
import { Module } from '@nestjs/common';
import { ${MODULE^}Service } from './${MODULE}.service';
import { ${MODULE^}Controller } from './${MODULE}.controller';

@Module({
  providers: [${MODULE^}Service],
  controllers: [${MODULE^}Controller]
})
export class ${MODULE^}Module {}
EOF

# controller.ts --------------------------------------------------------------------------------------------
cat << EOF > $API_DIR/${MODULE}.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ${MODULE^}Service } from './${MODULE}.service';

@Controller('${MODULE}')
export class ${MODULE^}Controller {
  constructor(private readonly service: ${MODULE^}Service) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
EOF

# service.ts ------------------------------------------------------------------------------------------------
cat << EOF > $API_DIR/${MODULE}.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class ${MODULE^}Service {
  findAll() {
    return ['${MODULE} funcionando'];
  }
}
EOF

echo ">> CRUD gerado com sucesso!"
