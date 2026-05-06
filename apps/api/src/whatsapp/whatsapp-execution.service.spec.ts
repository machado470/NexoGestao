import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { WhatsAppExecutionService } from './whatsapp-execution.service'

function createPrisma() {
  const store: any = {
    executions: new Map<string, any>(),
    conversations: new Map<string, any>(),
    events: [] as any[],
    audits: [] as any[],
  }
  const prisma: any = {
    whatsAppConversation: {
      findFirst: jest.fn(({ where }) => {
        const row = [...store.conversations.values()].find((item: any) => item.id === where.id && item.orgId === where.orgId)
        return Promise.resolve(row ? { ...row } : null)
      }),
      updateMany: jest.fn(({ where, data }) => {
        const row = store.conversations.get(where.id)
        if (row && row.orgId === where.orgId) Object.assign(row, data)
        return Promise.resolve({ count: row && row.orgId === where.orgId ? 1 : 0 })
      }),
    },
    whatsAppActionExecution: {
      findFirst: jest.fn(({ where }) => {
        const rows = [...store.executions.values()]
        const row = rows.find((item: any) => item.orgId === where.orgId && (where.id ? item.id === where.id : item.idempotencyKey === where.idempotencyKey))
        return Promise.resolve(row ? { ...row } : null)
      }),
      create: jest.fn(({ data }) => {
        const row = { id: `ex${store.executions.size + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data }
        store.executions.set(row.id, row)
        return Promise.resolve({ ...row })
      }),
      update: jest.fn(({ where, data }) => {
        const row = store.executions.get(where.id)
        Object.assign(row, data, { updatedAt: new Date() })
        return Promise.resolve({ ...row })
      }),
      findMany: jest.fn(({ where }) => Promise.resolve([...store.executions.values()].filter((item: any) => item.orgId === where.orgId && (!where.status || item.status === where.status) && (!where.conversationId || item.conversationId === where.conversationId)))),
    },
    appointment: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditEvent: {
      create: jest.fn(({ data }) => {
        store.audits.push(data)
        return Promise.resolve({ id: `audit${store.audits.length}`, ...data })
      }),
    },
  }
  return { prisma, store }
}

function createService() {
  const { prisma, store } = createPrisma()
  store.conversations.set('conv1', { id: 'conv1', orgId: 'org1', customerId: 'cust1', phone: '+5511999999999', contextType: 'APPOINTMENT', contextId: 'appt1' })
  store.conversations.set('conv2', { id: 'conv2', orgId: 'org2', customerId: 'cust2', phone: '+5511888888888', contextType: 'CHARGE', contextId: 'charge2' })
  const timeline = { log: jest.fn(async (event) => { store.events.push(event); return { id: `tl${store.events.length}`, ...event } }) }
  const whatsapp = {
    sendTemplateMessage: jest.fn().mockResolvedValue({ created: true, message: { id: 'msg1' } }),
    sendManualMessage: jest.fn().mockResolvedValue({ created: true, message: { id: 'msg2' } }),
    updateConversationStatus: jest.fn(async (_orgId, id, status) => {
      const row = store.conversations.get(id)
      if (row) row.status = status
      return row
    }),
  }
  return { service: new WhatsAppExecutionService(prisma, timeline as any, whatsapp as any), prisma, timeline, whatsapp, store }
}

describe('WhatsAppExecutionService deterministic workflows', () => {
  it('creates payment workflows as pending approval and records audit without sending', async () => {
    const { service, whatsapp, store } = createService()
    const execution = await service.requestExecution({ orgId: 'org1', conversationId: 'conv1', suggestedAction: 'SEND_PAYMENT_LINK' as any, requestedBy: 'u1', actionPayload: { paymentLink: 'https://pay.local/1' } })

    expect(execution.status).toBe('PENDING_APPROVAL')
    expect(execution.approvalRequired).toBe(true)
    expect(whatsapp.sendTemplateMessage).not.toHaveBeenCalled()
    expect(store.audits).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'whatsapp.action.pending_approval', orgId: 'org1' })]))
  })

  it('approves then executes customer-facing workflow with approval/executed timeline events', async () => {
    const { service, whatsapp, store } = createService()
    const pending = await service.requestExecution({ orgId: 'org1', conversationId: 'conv1', suggestedAction: 'SEND_PAYMENT_LINK' as any, actionPayload: { paymentLink: 'https://pay.local/1', customerName: 'Ana' } })

    const approved = await service.approve({ orgId: 'org1', executionId: pending.id, actorUserId: 'manager1', reason: 'Cobrança conferida' })
    const executed = await service.execute({ orgId: 'org1', executionId: pending.id, actorUserId: 'manager1' })

    expect(approved.status).toBe('APPROVED')
    expect(executed.status).toBe('EXECUTED')
    expect(whatsapp.sendTemplateMessage).toHaveBeenCalledWith('org1', 'manager1', expect.objectContaining({ templateKey: 'payment_link', messageType: 'PAYMENT_LINK' }))
    expect(store.events.map((event: any) => event.action)).toEqual(expect.arrayContaining(['WHATSAPP_ACTION_APPROVED', 'WHATSAPP_ACTION_EXECUTED']))
  })

  it('safe low-risk actions auto-execute only explicitly low-risk deterministic operations', async () => {
    const { service, store } = createService()
    const execution = await service.requestExecution({ orgId: 'org1', conversationId: 'conv1', suggestedAction: 'ESCALATE_TO_OPERATOR' as any, requestedBy: 'u1' })

    expect(execution.status).toBe('EXECUTED')
    expect(store.conversations.get('conv1').status).toBe('WAITING_OPERATOR')
    expect(store.events.map((event: any) => event.action)).toContain('WHATSAPP_ACTION_EXECUTED')
  })

  it('records failed execution and does not throw so operators can inspect result', async () => {
    const { service, store } = createService()
    const pending = await service.requestExecution({ orgId: 'org1', conversationId: 'conv1', suggestedAction: 'SEND_PAYMENT_LINK' as any, actionPayload: {} })
    await service.approve({ orgId: 'org1', executionId: pending.id, actorUserId: 'u1' })

    const failed = await service.execute({ orgId: 'org1', executionId: pending.id, actorUserId: 'u1' })

    expect(failed.status).toBe('FAILED')
    expect(failed.failureReason).toContain('paymentLink')
    expect(store.events.map((event: any) => event.action)).toContain('WHATSAPP_ACTION_FAILED')
  })

  it('is idempotent for duplicate execution requests and duplicate execute calls', async () => {
    const { service, whatsapp } = createService()
    const first = await service.requestExecution({ orgId: 'org1', conversationId: 'conv1', suggestedAction: 'MARK_RESOLVED' as any, idempotencyKey: 'same-key' })
    const duplicate = await service.requestExecution({ orgId: 'org1', conversationId: 'conv1', suggestedAction: 'MARK_RESOLVED' as any, idempotencyKey: 'same-key' })
    const replay = await service.execute({ orgId: 'org1', executionId: first.id, actorUserId: 'u1' })

    expect(duplicate.id).toBe(first.id)
    expect(replay.status).toBe('EXECUTED')
    expect(whatsapp.updateConversationStatus).toHaveBeenCalledTimes(1)
  })

  it('prevents tenant isolation breaches for conversations and executions', async () => {
    const { service } = createService()
    await expect(service.requestExecution({ orgId: 'org1', conversationId: 'conv2', suggestedAction: 'MARK_RESOLVED' as any })).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.getStatus('org2', 'missing')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('requires approval before executing sensitive workflows and supports cancellation audit timeline', async () => {
    const { service, store } = createService()
    const pending = await service.requestExecution({ orgId: 'org1', conversationId: 'conv1', suggestedAction: 'CONFIRM_APPOINTMENT' as any, actionPayload: { appointmentDate: '06/05/2026', appointmentTime: '10:00' } })

    await expect(service.execute({ orgId: 'org1', executionId: pending.id, actorUserId: 'u1' })).rejects.toBeInstanceOf(ConflictException)
    const cancelled = await service.cancel({ orgId: 'org1', executionId: pending.id, actorUserId: 'u1', reason: 'Cliente pediu pausa' })

    expect(cancelled.status).toBe('CANCELLED')
    expect(store.events.map((event: any) => event.action)).toContain('WHATSAPP_ACTION_CANCELLED')
  })

  it('rejects non-executable suggested actions', async () => {
    const { service } = createService()
    await expect(service.requestExecution({ orgId: 'org1', conversationId: 'conv1', suggestedAction: 'OPEN_SERVICE_ORDER' as any })).rejects.toBeInstanceOf(BadRequestException)
  })
})
