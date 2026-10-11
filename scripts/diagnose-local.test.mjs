import test from 'node:test'
import assert from 'node:assert/strict'
import { summarize, transportFailure } from './diagnose-local.mjs'

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

test('transport report includes safe reason without secret-bearing error text', () => {
  assert.deepEqual(transportFailure({ cause: { code: 'ECONNREFUSED' }, message: 'SECRET' }), { http: null, state: 'TRANSPORT_ERROR', reason: 'ECONNREFUSED' })
  assert.equal(transportFailure({ name: 'TimeoutError' }).reason, 'TIMEOUT')
  assert.equal(transportFailure({ cause: { code: 'SECRET' } }).reason, 'REQUEST_FAILED')
})
