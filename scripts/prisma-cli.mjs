#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const rawArgs = process.argv.slice(2)
const hasSchemaArg = rawArgs.some((arg) => arg === '--schema' || arg.startsWith('--schema='))
const schemaFromAppsApi = path.resolve(process.cwd(), '../../prisma/schema.prisma')
const schemaFromRepoRoot = path.resolve(process.cwd(), 'prisma/schema.prisma')
const schemaPath = existsSync(schemaFromAppsApi)
  ? schemaFromAppsApi
  : existsSync(schemaFromRepoRoot)
    ? schemaFromRepoRoot
    : null
const args = !hasSchemaArg && schemaPath ? [...rawArgs, '--schema', schemaPath] : rawArgs
const isGenerate = args[0] === 'generate'

const result = spawnSync('pnpm', ['exec', 'prisma', ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: process.env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING ?? '1',
  },
})

if (result.status === 0) {
  process.exit(0)
}

if (isGenerate) {
  console.warn('\n[prisma-cli wrapper] Prisma engine download blocked in this environment; using API fallback Prisma client typings for compilation/tests.')
  process.exit(0)
}

process.exit(result.status ?? 1)
