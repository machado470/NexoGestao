import { afterEach, describe, expect, it, vi } from 'vitest'
import { appRouter } from './routers'

const caller = () => appRouter.createCaller({
  req: { headers: {}, cookies: {} }, res: { cookie: vi.fn(), clearCookie: vi.fn() },
  user: { id: 'admin', organizationId: 'org-server', token: 'synthetic-token', validated: true },
} as any)

describe('Subscription admission errors through the BFF', () => {
  afterEach(() => vi.restoreAllMocks())
  it.each(['Assinatura suspensa por política comercial.', 'Assinatura com pagamento pendente.', 'Assinatura cancelada. Faça upgrade para reativar este recurso.', 'Trial expirado. Recurso restrito até atualizar o plano.'])('preserves the API restriction without treating it as session expiry: %s', async message => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message, statusCode: 403 }), { status: 403 }))
    await expect(caller().customers.create({ name: 'Synthetic customer', phone: '11900000000' })).rejects.toMatchObject({ code: 'FORBIDDEN', message })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/customers'), expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer synthetic-token' }) }))
  })
})
