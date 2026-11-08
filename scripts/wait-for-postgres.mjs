#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'

export function databaseEndpoint(raw) {
  try {
    const url = new URL(raw)
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) throw new Error()
    return {
      host: url.hostname.replace(/^\[|\]$/g, ''),
      port: url.port || '5432',
      user: decodeURIComponent(url.username),
      database: decodeURIComponent(url.pathname.slice(1)),
    }
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL with a database name')
  }
}

export async function waitForPostgres(env = process.env, probe = spawnSync, pause = setTimeout) {
  const db = databaseEndpoint(env.DATABASE_URL)
  const seconds = Number(env.DB_WAIT_SECONDS ?? 40)
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 600) throw new Error('DB_WAIT_SECONDS must be an integer from 1 to 600')
  for (let i = 0; i < seconds; i++) {
    const result = probe('pg_isready', ['-h', db.host, '-p', db.port, '-U', db.user, '-d', db.database], { stdio: 'ignore', timeout: 1000 })
    if (result.error) throw new Error('Could not execute pg_isready')
    if (result.status === 0) return
    if (i + 1 < seconds) await pause(1000)
  }
  throw new Error('PostgreSQL readiness timeout; application was not started')
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  waitForPostgres().catch(error => {
    console.error(`[nexogestao] ${error.message}`)
    process.exitCode = 1
  })
}
