import { describe, expect, it } from 'vitest'
import { resolveNexoApiUrl } from './nexoApiUrl'

describe('resolveNexoApiUrl', () => {
  it('normaliza localhost e adiciona o prefixo global da API', () => {
    expect(resolveNexoApiUrl('http://localhost:3000')).toBe('http://127.0.0.1:3000/v1')
  })

  it('não duplica o prefixo quando NEXO_API_URL já inclui /v1', () => {
    expect(resolveNexoApiUrl('http://localhost:3000/v1')).toBe('http://127.0.0.1:3000/v1')
  })
})
