import test from 'node:test'
import assert from 'node:assert/strict'
import { summarize } from './diagnose-local.mjs'

test('distinguishes empty page, zero total, absent body and errors', () => {
  assert.deepEqual(summarize({ items: [], total: 0 }), { state: 'EMPTY_PAGE', returned: 0, total: 0 })
  assert.deepEqual(summarize(null), { state: 'INVALID_RESPONSE' })
  assert.deepEqual(summarize({ success: false, token: 'secret' }), { state: 'ERROR', code: 'API_ERROR' })
  assert.deepEqual(summarize({ error: { json: { data: { code: 'UNAUTHORIZED' } } } }, true), { state: 'ERROR', code: 'UNAUTHORIZED' })
})

test('unwraps BFF and API while excluding identities, credentials and record content', () => {
  const payload = { result: { data: { json: { success: true, data: { items: [{ name: 'PRIVATE', password: 'SECRET' }], total: 1, token: 'SECRET', availability: 'NO_DATA' } } } } }
  assert.deepEqual(summarize(payload, true), { state: 'DATA', returned: 1, total: 1, availability: 'NO_DATA' })
  assert.equal(JSON.stringify(summarize(payload, true)).includes('SECRET'), false)
})
