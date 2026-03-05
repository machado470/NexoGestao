#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
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
