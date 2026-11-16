import { test } from 'node:test'
import assert from 'node:assert/strict'
import { databaseEndpoint, waitForPostgres } from './wait-for-postgres.mjs'

test('decodes credentials/database and supports default ports and IPv6', () => {
  assert.deepEqual(databaseEndpoint('postgresql://user%40org:p%3A%40%2F@db/example%2Ddb?schema=public'), { host: 'db', port: '5432', user: 'user@org', database: 'example-db' })
  assert.equal(databaseEndpoint('postgres://u:p@[::1]:5544/db').host, '::1')
  assert.equal(databaseEndpoint('postgres://u:p@[::1]:5544/db').port, '5544')
})

test('invalid URLs fail without disclosing credentials', () => {
  for (const raw of ['', 'secret-password', 'https://u:secret@db/db', 'postgres://db/']) {
    assert.throws(() => databaseEndpoint(raw), /^Error: DATABASE_URL must be/)
  }
})

test('passes separate arguments to pg_isready and retries until ready', async () => {
  let calls = 0
  await waitForPostgres({ DATABASE_URL: 'postgres://u:p@db:5544/my%20db', DB_WAIT_SECONDS: '3' }, (cmd, args) => {
    assert.equal(cmd, 'pg_isready')
    assert.deepEqual(args, ['-h', 'db', '-p', '5544', '-U', 'u', '-d', 'my db'])
    return { status: ++calls === 2 ? 0 : 1 }
  }, async () => {})
  assert.equal(calls, 2)
})

test('timeout and missing readiness executable prevent startup', async () => {
  const env = { DATABASE_URL: 'postgres://u:p@db/db', DB_WAIT_SECONDS: '1' }
  await assert.rejects(waitForPostgres(env, () => ({ status: 1 })), /timeout/)
  await assert.rejects(waitForPostgres(env, () => ({ error: new Error('missing') })), /execute pg_isready/)
  await assert.rejects(waitForPostgres({ ...env, DB_WAIT_SECONDS: 'NaN' }), /DB_WAIT_SECONDS/)
})
