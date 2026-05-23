import { BadRequestException, ConflictException } from '@nestjs/common'
import { OperationalActionsService } from './operational-actions.service'

describe('OperationalActionsService', () => {
  const timeline = { log: jest.fn().mockResolvedValue(null) }
  const whatsapp = { retryFailedMessage: jest.fn().mockResolvedValue({ ok: true }) }
  const finance = { remindChargeInOrg: jest.fn().mockResolvedValue(undefined) }
  const risk = { recalculatePersonRisk: jest.fn().mockResolvedValue({ score: 70, state: 'WARNING' }) }
  const governanceRun = { startRun: jest.fn(), finish: jest.fn().mockResolvedValue({ institutionalRiskScore: 85 }) }

  beforeEach(() => jest.clearAllMocks())

  it('bloqueia sem actor/org', async () => {
    const prisma: any = { operationalActionExecution: { findFirst: jest.fn().mockResolvedValue(null) } }
    const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
    await expect(service.execute({ orgId: '', actorUserId: '', actionType: 'RUN_GOVERNANCE_CHECK', entityId: 'x' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('request cria estado materializado e timeline', async () => {
    const prisma: any = { operationalActionExecution: { create: jest.fn().mockResolvedValue({ id: 'e1' }) } }
    const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
    const result = await service.request({ orgId: 'org-1', actorUserId: 'u-1', actionType: 'RUN_GOVERNANCE_CHECK', entityType: 'GENERAL', entityId: 'entity-1', metadata: { suggestedAction: 'Executar governança', relatedChargeId: 'ch-1' } })
    expect(result.status).toBe('REQUESTED')
    expect(prisma.operationalActionExecution.create).toHaveBeenCalled()
    expect(governanceRun.startRun).not.toHaveBeenCalled()
    expect(timeline.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'OPERATIONAL_ACTION_REQUESTED' }))
  })

  it('executa retry para FAILED, atualiza estado para EXECUTED e gera timeline sucesso', async () => {
    const prisma: any = {
      operationalActionExecution: {
        findFirst: jest.fn().mockResolvedValue({ id: 'e1', status: 'REQUESTED' }),
        update: jest.fn().mockResolvedValue({ id: 'e1', status: 'EXECUTED' }),
      },
      whatsAppMessage: { findFirst: jest.fn().mockResolvedValue({ id: 'm1', status: 'FAILED', customerId: 'c1' }) },
    }
    const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
    const result = await service.execute({ orgId: 'org-1', actorUserId: 'u-1', actionType: 'RETRY_WHATSAPP_MESSAGE', entityId: 'm1' })
    expect(result.status).toBe('EXECUTED')
    expect(prisma.operationalActionExecution.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'EXECUTED' }) }))
    expect(whatsapp.retryFailedMessage).toHaveBeenCalledWith('org-1', 'm1')
  })

  it('cancel atualiza estado para CANCELED e registra timeline', async () => {
    const prisma: any = {
      operationalActionExecution: {
        findFirst: jest.fn().mockResolvedValue({ id: 'e1', status: 'REQUESTED' }),
        update: jest.fn().mockResolvedValue({ id: 'e1', status: 'CANCELED' }),
      },
    }
    const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
    const result = await service.cancel({ orgId: 'org-1', actorUserId: 'u-1', actionType: 'RUN_GOVERNANCE_CHECK', entityType: 'GENERAL', entityId: 'entity-1', sourceSignalId: 's-1', metadata: { suggestedAction: 'x' } })
    expect(result.status).toBe('CANCELED')
    expect(prisma.operationalActionExecution.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELED' }) }))
  })

  it('falha de execução atualiza estado para FAILED', async () => {
    const prisma: any = {
      operationalActionExecution: {
        findFirst: jest.fn().mockResolvedValue({ id: 'e1', status: 'REQUESTED' }),
        update: jest.fn().mockResolvedValue({ id: 'e1', status: 'FAILED' }),
      },
      charge: { findFirst: jest.fn().mockResolvedValue({ id: 'ch1', status: 'PAID', customerId: 'c1' }) },
    }
    const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
    await expect(service.execute({ orgId: 'org-1', actorUserId: 'u-1', actionType: 'SEND_PAYMENT_REMINDER', entityId: 'ch1' })).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.operationalActionExecution.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }))
  })

  it('bloqueia transições inválidas a partir de CANCELED/EXECUTED/FAILED', async () => {
    for (const status of ['CANCELED', 'EXECUTED', 'FAILED'] as const) {
      const prisma: any = { operationalActionExecution: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', status }) } }
      const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
      await expect(service.execute({ orgId: 'org-1', actorUserId: 'u-1', actionType: 'RUN_GOVERNANCE_CHECK', entityId: 'entity-1' })).rejects.toBeInstanceOf(ConflictException)
    }
  })
})
