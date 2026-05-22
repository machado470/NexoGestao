import { BadRequestException } from '@nestjs/common'
import { OperationalActionsService } from './operational-actions.service'

describe('OperationalActionsService', () => {
  const timeline = { log: jest.fn().mockResolvedValue(null) }
  const whatsapp = { retryFailedMessage: jest.fn().mockResolvedValue({ ok: true }) }
  const finance = { remindChargeInOrg: jest.fn().mockResolvedValue(undefined) }
  const risk = { recalculatePersonRisk: jest.fn().mockResolvedValue({ score: 70, state: 'WARNING' }) }
  const governanceRun = { startRun: jest.fn(), finish: jest.fn().mockResolvedValue({ institutionalRiskScore: 85 }) }

  beforeEach(() => jest.clearAllMocks())

  it('bloqueia sem actor/org', async () => {
    const prisma: any = {}
    const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
    await expect(service.execute({ orgId: '', actorUserId: '', actionType: 'RUN_GOVERNANCE_CHECK', entityId: 'x' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('executa retry para FAILED e gera timeline sucesso', async () => {
    const prisma: any = { whatsAppMessage: { findFirst: jest.fn().mockResolvedValue({ id: 'm1', status: 'FAILED', customerId: 'c1' }) } }
    const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
    const result = await service.execute({ orgId: 'org-1', actorUserId: 'u-1', actionType: 'RETRY_WHATSAPP_MESSAGE', entityId: 'm1' })
    expect(result.status).toBe('SUCCEEDED')
    expect(whatsapp.retryFailedMessage).toHaveBeenCalledWith('org-1', 'm1')
    expect(timeline.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'OPERATIONAL_ACTION_EXECUTED' }))
  })

  it('bloqueia reminder para PAID', async () => {
    const prisma: any = { charge: { findFirst: jest.fn().mockResolvedValue({ id: 'ch1', status: 'PAID', customerId: 'c1' }) } }
    const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
    await expect(service.execute({ orgId: 'org-1', actorUserId: 'u-1', actionType: 'SEND_PAYMENT_REMINDER', entityId: 'ch1' })).rejects.toBeInstanceOf(BadRequestException)
  })
})
