#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const schemaPath = path.resolve(repoRoot, 'prisma/schema.prisma')
const clientMarkerPaths = [
  path.resolve(repoRoot, 'node_modules/.prisma/client/index.d.ts'),
  path.resolve(repoRoot, 'node_modules/.prisma/client/default.d.ts'),
]

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/nexogestao',
    },
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

if (!existsSync(schemaPath)) {
  console.error('[prisma-check] schema não encontrado em prisma/schema.prisma.')
  process.exit(1)
}

console.log('[prisma-check] validando schema Prisma...')
run('pnpm', ['exec', 'prisma', 'validate', '--schema', schemaPath])

console.log('[prisma-check] gerando Prisma Client...')
run('pnpm', ['prisma:generate'])

let markerPath = clientMarkerPaths.find((candidate) => existsSync(candidate))
if (!markerPath) {
  const discovery = spawnSync(
    'bash',
    ['-lc', "find node_modules -path '*@prisma*client*' -name 'default.d.ts' | head -n 1"],
    { cwd: repoRoot, encoding: 'utf8' },
  )
  const discovered = discovery.stdout?.trim()
  if (discovered && existsSync(path.resolve(repoRoot, discovered))) {
    markerPath = path.resolve(repoRoot, discovered)
  }
}
if (!markerPath) {
  console.error('[prisma-check] Prisma Client não foi encontrado em node_modules/.prisma/client após generate.')
  process.exit(1)
}

const schemaMtime = statSync(schemaPath).mtimeMs
const clientMtime = statSync(markerPath).mtimeMs

if (clientMtime < schemaMtime) {
  console.error('[prisma-check] Prisma Client parece desatualizado: schema.prisma é mais novo que o client gerado.')
  console.error('[prisma-check] Execute `pnpm prisma:generate` no mesmo commit/schema antes de typecheck/build/test.')
  process.exit(1)
}

console.log(`[prisma-check] OK: Prisma Client gerado e alinhado ao schema (${path.relative(repoRoot, markerPath)}).`)
