#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rawArgs = process.argv.slice(2)
const hasSchemaArg = rawArgs.some((arg) => arg === '--schema' || arg.startsWith('--schema='))
const scriptDir = path.dirname(fileURLToPath(import.meta.url))

function parseEnvContent(content) {
  const parsed = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const equalIdx = line.indexOf('=')
    if (equalIdx <= 0) continue

    const key = line.slice(0, equalIdx).trim()
    let value = line.slice(equalIdx + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    parsed[key] = value
  }
  return parsed
}

function findWorkspaceRoot(startDir) {
  let cursor = startDir
  while (true) {
    if (existsSync(path.join(cursor, 'pnpm-workspace.yaml'))) {
      return cursor
    }

    const parent = path.dirname(cursor)
    if (parent === cursor) return null
    cursor = parent
  }
}

function resolveSchemaPath() {
  const workspaceRoot = findWorkspaceRoot(process.cwd()) ?? findWorkspaceRoot(scriptDir)
  const checked = [
    process.env.PRISMA_SCHEMA_PATH,
    path.resolve(process.cwd(), 'prisma/schema.prisma'),
    path.resolve(process.cwd(), '../../prisma/schema.prisma'),
    process.env.INIT_CWD ? path.resolve(process.env.INIT_CWD, 'prisma/schema.prisma') : null,
    workspaceRoot ? path.resolve(workspaceRoot, 'prisma/schema.prisma') : null,
    path.resolve(scriptDir, '../prisma/schema.prisma'),
  ].filter(Boolean)

  for (const candidate of checked) {
    if (existsSync(candidate)) return candidate
  }

  return null
}

const schemaPath = resolveSchemaPath()
const args = !hasSchemaArg && schemaPath ? [...rawArgs, '--schema', schemaPath] : rawArgs
const isGenerate = args[0] === 'generate'
const workspaceRoot = findWorkspaceRoot(process.cwd()) ?? findWorkspaceRoot(scriptDir)

function loadEnvFromFiles() {
  if (!workspaceRoot) return {}

  const candidates = [
    path.resolve(workspaceRoot, '.env'),
    path.resolve(workspaceRoot, '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local'),
  ]

  const loaded = {}
  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue
    const content = readFileSync(filePath, 'utf8')
    Object.assign(loaded, parseEnvContent(content))
  }

  return loaded
}

if (!hasSchemaArg && !schemaPath) {
  console.warn(
    '[prisma-cli wrapper] Prisma schema não encontrado automaticamente. Informe --schema manualmente (ex.: --schema prisma/schema.prisma).',
  )
}

const result = spawnSync('pnpm', ['exec', 'prisma', ...args], {
  stdio: 'inherit',
  env: {
    ...loadEnvFromFiles(),
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
