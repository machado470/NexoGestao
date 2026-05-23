import { BadRequestException, ConflictException } from '@nestjs/common'
import { OperationalActionsService } from './operational-actions.service'

describe('OperationalActionsService', () => {
  const timeline = { log: jest.fn().mockResolvedValue(null) }
  const whatsapp = { retryFailedMessage: jest.fn().mockResolvedValue({ ok: true }) }
  const finance = { remindChargeInOrg: jest.fn().mockResolvedValue(undefined) }
  const risk = { recalculatePersonRisk: jest.fn().mockResolvedValue({ score: 70, state: 'WARNING' }) }
  const governanceRun = { startRun: jest.fn(), finish: jest.fn().mockResolvedValue({ institutionalRiskScore: 85 }) }
  beforeEach(() => jest.clearAllMocks())

  it('request duplicado retorna existente e não duplica timeline', async () => {
    const prisma: any = { operationalActionExecution: { findFirst: jest.fn().mockResolvedValue({ requestedAt: new Date('2026-01-01T00:00:00Z') }) } }
    const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
    const out = await service.request({ orgId: 'org-1', actorUserId: 'u-1', actionType: 'RUN_GOVERNANCE_CHECK', entityType: 'GENERAL', entityId: 'e-1' })
    expect(out.idempotent).toBe(true)
    expect(timeline.log).not.toHaveBeenCalled()
  })

  it('execute duplicado não chama ação real duas vezes', async () => {
    const prisma: any = { operationalActionExecution: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', status: 'EXECUTED', logicalKey: 'k' }) } }
    const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
    const out = await service.execute({ orgId: 'org-1', actorUserId: 'u-1', actionType: 'RETRY_WHATSAPP_MESSAGE', entityType: 'WHATSAPP', entityId: 'm1' })
    expect(out.idempotent).toBe(true)
    expect(whatsapp.retryFailedMessage).not.toHaveBeenCalled()
  })

  it('execute concorrente bloqueia quando reserva falha', async () => {
    const prisma: any = { operationalActionExecution: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', status: 'REQUESTED', logicalKey: 'k' }), updateMany: jest.fn().mockResolvedValue({ count: 0 }) } }
    const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
    await expect(service.execute({ orgId: 'org-1', actorUserId: 'u-1', actionType: 'RUN_GOVERNANCE_CHECK', entityType: 'GENERAL', entityId: 'x' })).rejects.toBeInstanceOf(ConflictException)
  })

  it('cancel duplicado não gera timeline duplicada', async () => {
    const prisma: any = { operationalActionExecution: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', status: 'CANCELED' }) } }
    const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
    const out = await service.cancel({ orgId: 'org-1', actorUserId: 'u-1', actionType: 'RUN_GOVERNANCE_CHECK', entityType: 'GENERAL', entityId: 'x' })
    expect(out.idempotent).toBe(true)
    expect(timeline.log).not.toHaveBeenCalled()
  })

  it('bloqueia execute/cancel para status inválidos', async () => {
    for (const status of ['FAILED', 'CANCELED'] as const) {
      const prisma: any = { operationalActionExecution: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', status, logicalKey: 'k' }) } }
      const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
      await expect(service.execute({ orgId: 'org-1', actorUserId: 'u-1', actionType: 'RUN_GOVERNANCE_CHECK', entityType: 'GENERAL', entityId: 'x' })).rejects.toBeInstanceOf(ConflictException)
    }
    const prisma2: any = { operationalActionExecution: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', status: 'EXECUTED' }) } }
    const service2 = new OperationalActionsService(prisma2, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
    await expect(service2.cancel({ orgId: 'org-1', actorUserId: 'u-1', actionType: 'RUN_GOVERNANCE_CHECK', entityType: 'GENERAL', entityId: 'x' })).rejects.toBeInstanceOf(ConflictException)
  })



  it('não colide execução entre entityTypes com mesma entidade/sinal', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({ id: 'exec-service-order', status: 'EXECUTED', logicalKey: 'RUN_GOVERNANCE_CHECK:SERVICE_ORDER:shared:sig-1' })
      .mockResolvedValueOnce({ id: 'exec-customer', status: 'EXECUTED', logicalKey: 'RUN_GOVERNANCE_CHECK:CUSTOMER:shared:sig-1' })
    const prisma: any = { operationalActionExecution: { findFirst } }
    const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)

    await service.execute({ orgId: 'org-1', actorUserId: 'u-1', actionType: 'RUN_GOVERNANCE_CHECK', entityType: 'SERVICE_ORDER', entityId: 'shared', sourceSignalId: 'sig-1' })
    await service.execute({ orgId: 'org-1', actorUserId: 'u-1', actionType: 'RUN_GOVERNANCE_CHECK', entityType: 'CUSTOMER', entityId: 'shared', sourceSignalId: 'sig-1' })

    expect(findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { orgId: 'org-1', logicalKey: 'RUN_GOVERNANCE_CHECK:SERVICE_ORDER:shared:sig-1' } }))
    expect(findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { orgId: 'org-1', logicalKey: 'RUN_GOVERNANCE_CHECK:CUSTOMER:shared:sig-1' } }))
  })

  it('cancel usa logicalKey completa com entityType', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'e1', status: 'CANCELED' })
    const prisma: any = { operationalActionExecution: { findFirst } }
    const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)

    await service.cancel({ orgId: 'org-1', actorUserId: 'u-1', actionType: 'RUN_GOVERNANCE_CHECK', entityType: 'SERVICE_ORDER', entityId: 'same-id', sourceSignalId: 'sig-1' })

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId: 'org-1', logicalKey: 'RUN_GOVERNANCE_CHECK:SERVICE_ORDER:same-id:sig-1' } }))
  })

  it('bloqueia sem actor/org', async () => {
    const prisma: any = { operationalActionExecution: { findFirst: jest.fn().mockResolvedValue(null) } }
    const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
    await expect(service.execute({ orgId: '', actorUserId: '', actionType: 'RUN_GOVERNANCE_CHECK', entityType: 'GENERAL', entityId: 'x' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('diagnostics agrega por org/status e calcula médias/limites', async () => {
    const prisma: any = {
      operationalActionExecution: {
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([{ status: 'REQUESTED', _count: { _all: 2 } }, { status: 'FAILED', _count: { _all: 3 } }])
          .mockResolvedValueOnce([{ actionType: 'RETRY_WHATSAPP_MESSAGE', _count: { _all: 2 } }, { actionType: 'RUN_GOVERNANCE_CHECK', _count: { _all: 1 } }]),
        count: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(3),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ requestedAt: new Date('2026-01-01T00:00:00Z'), executedAt: new Date('2026-01-01T00:01:00Z') }])
          .mockResolvedValueOnce([{ requestedAt: new Date('2026-01-01T00:00:00Z'), failedAt: new Date('2026-01-01T00:02:00Z') }])
          .mockResolvedValueOnce([{ id: 'f1', actionType: 'RETRY_WHATSAPP_MESSAGE', entityType: 'WHATSAPP', entityId: 'm1', failedAt: new Date('2026-01-02T00:00:00Z'), failureReason: 'boom' }]),
      },
    }
    const service = new OperationalActionsService(prisma, timeline as any, whatsapp as any, finance as any, risk as any, governanceRun as any)
    const out = await service.getOperationalActionsDiagnostics('org-9')

    expect(out.totalsByStatus).toEqual({ REQUESTED: 2, EXECUTING: 0, EXECUTED: 0, FAILED: 3, CANCELED: 0 })
    expect(out.pendingRequestedCount).toBe(2)
    expect(out.stuckExecutingCount).toBe(1)
    expect(out.failedLast24hCount).toBe(3)
    expect(out.avgRequestedToExecutedMs).toBe(60000)
    expect(out.avgRequestedToFailedMs).toBe(120000)
    expect(out.topFailedActionTypes).toEqual([{ actionType: 'RETRY_WHATSAPP_MESSAGE', count: 2 }, { actionType: 'RUN_GOVERNANCE_CHECK', count: 1 }])
    expect(out.recentFailures).toHaveLength(1)
    expect(out.recentFailures[0].failedAt).toBe('2026-01-02T00:00:00.000Z')

    expect(prisma.operationalActionExecution.count).toHaveBeenCalledWith({ where: { orgId: 'org-9', status: 'REQUESTED' } })
    expect(prisma.operationalActionExecution.groupBy).toHaveBeenCalledWith(expect.objectContaining({ by: ['status'], where: { orgId: 'org-9' } }))
    expect(prisma.operationalActionExecution.findMany).toHaveBeenNthCalledWith(3, expect.objectContaining({ where: { orgId: 'org-9', status: 'FAILED' }, take: 10 }))
  })
})
