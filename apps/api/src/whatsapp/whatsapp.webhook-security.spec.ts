import { BadRequestException } from '@nestjs/common'
import { WhatsAppController } from './whatsapp.controller'
import { MetaCloudWhatsAppProvider } from './providers/meta-cloud.provider'

jest.mock('./providers/provider.factory', () => ({
  createWhatsAppProvider: () => ({
    getProviderName: () => 'mock',
    verifyWebhookSignature: jest.fn((payload: any) => payload?.signatureOk !== false),
  }),
  getWhatsAppProviderReadiness: () => ({ mode: 'mock', isReady: true, missingEnv: [] }),
}))

describe('WhatsApp webhook security', () => {
  it('rejeita webhook sem orgId multi-tenant', async () => {
    const controller = new WhatsAppController(
      { createWebhookEvent: jest.fn(), processInboundWebhook: jest.fn(), completeWebhookEvent: jest.fn() } as any,
      {} as any,
      {} as any,
    )

    await expect(controller.webhook('mock', { phone: '+5511999999999' }, {})).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejeita assinatura inválida antes de persistir payload', async () => {
    const service = { createWebhookEvent: jest.fn(), processInboundWebhook: jest.fn(), completeWebhookEvent: jest.fn() }
    const controller = new WhatsAppController(service as any, {} as any, {} as any)

    await expect(controller.webhook('mock', { orgId: 'org1', signatureOk: false }, { 'x-org-id': 'org1' })).rejects.toBeInstanceOf(BadRequestException)
    expect(service.createWebhookEvent).not.toHaveBeenCalled()
  })

  it('persiste payload bruto e retorna 200-friendly ack com trace id', async () => {
    const service = {
      createWebhookEvent: jest.fn().mockResolvedValue({ id: 'wh1' }),
      processInboundWebhook: jest.fn().mockResolvedValue({ results: [{ orgId: 'org1' }] }),
      completeWebhookEvent: jest.fn().mockResolvedValue({}),
    }
    const controller = new WhatsAppController(service as any, {} as any, {} as any)

    const result = await controller.webhook('mock', { orgId: 'org1', phone: '+5511999999999' }, { 'x-org-id': 'org1', 'x-request-id': 'trace-1' })

    expect(result).toEqual(expect.objectContaining({ ok: true, received: true, traceId: 'trace-1', webhookEventId: 'wh1' }))
    expect(service.createWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org1', provider: 'mock', payload: expect.objectContaining({ phone: '+5511999999999' }) }))
    expect(service.processInboundWebhook).toHaveBeenCalledWith('mock', expect.any(Object), expect.objectContaining({ orgId: 'org1', traceId: 'trace-1', webhookEventId: 'wh1' }))
  })

  it('valida assinatura Meta sem lançar em assinatura com tamanho inválido', async () => {
    process.env.META_APP_SECRET = 'secret'
    const provider = new MetaCloudWhatsAppProvider()
    await expect(provider.verifyWebhookSignature({ orgId: 'org1' }, { 'x-hub-signature-256': 'sha256=short' })).resolves.toBe(false)
  })
})
