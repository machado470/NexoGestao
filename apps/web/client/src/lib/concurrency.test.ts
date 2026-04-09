import { describe, expect, it } from 'vitest'
import { extractErrorCode, isConcurrentConflictError } from './concurrency'

describe('concurrency helpers', () => {
  it('extracts code from message fallback', () => {
    expect(extractErrorCode({ message: 'Erro [SERVICE_ORDER_CONCURRENT_MODIFICATION]' })).toBe(
      'SERVICE_ORDER_CONCURRENT_MODIFICATION',
    )
  })

  it('detects conflict from trpc status', () => {
    expect(isConcurrentConflictError({ data: { httpStatus: 409 } })).toBe(true)
  })
})
