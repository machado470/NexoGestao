import { Worker } from 'bullmq'
import { WhatsAppService } from './whatsapp.service'
import { WhatsAppDispatcherJob } from './whatsapp.dispatcher.job'
import { WhatsAppProcessor } from '../queue/processors/whatsapp.processor'
import { WhatsAppDlqProcessor } from '../queue/processors/whatsapp-dlq.processor'

jest.mock('bullmq', () => ({ Worker: jest.fn() }))

describe('WhatsApp explicitly disabled in production', () => {
  const previous = { provider: process.env.WHATSAPP_PROVIDER, nodeEnv: process.env.NODE_ENV }
  beforeEach(() => {
    process.env.WHATSAPP_PROVIDER = 'disabled'
    process.env.NODE_ENV = 'production'
    jest.clearAllMocks()
  })
  afterEach(() => {
    for (const [key, value] of [['WHATSAPP_PROVIDER', previous.provider], ['NODE_ENV', previous.nodeEnv]]) {
      if (value === undefined) delete process.env[key!]
      else process.env[key!] = value
    }
  })

  it('rejects admission before creating records, charging quotas or enqueueing', async () => {
    const prisma = { $transaction: jest.fn() }
    const queue = { addJob: jest.fn(), reserveWhatsAppAdmission: jest.fn() }
    const commercial = { enforceMeter: jest.fn() }
    const service = new WhatsAppService(prisma as any, queue as any, {} as any, {} as any, {} as any, {} as any, commercial as any, {} as any)
    await expect(service.sendManualMessage('org', 'user', { toPhone: '+5511999999999', content: 'oi' }))
      .rejects.toMatchObject({ status: 503, response: { code: 'WHATSAPP_DISABLED' } })
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(commercial.enforceMeter).not.toHaveBeenCalled()
    expect(queue.reserveWhatsAppAdmission).not.toHaveBeenCalled()
    expect(queue.addJob).not.toHaveBeenCalled()
  })

  it('preserves queued messages without claiming or reconciling them', async () => {
    const service = { claimQueued: jest.fn(), reconcileStaleSending: jest.fn() }
    const dispatcher = new WhatsAppDispatcherJob(service as any)
    await dispatcher.dispatchQueued()
    await dispatcher.reconcileStaleSendingMessages()
    expect(service.claimQueued).not.toHaveBeenCalled()
    expect(service.reconcileStaleSending).not.toHaveBeenCalled()
  })

  it('does not start outbound, inbound or dead-letter workers', async () => {
    const processor = new WhatsAppProcessor({} as any, {} as any, {} as any, {} as any, {} as any)
    const dlq = new WhatsAppDlqProcessor({} as any, {} as any)
    await processor.onModuleInit()
    await dlq.onModuleInit()
    expect(Worker).not.toHaveBeenCalled()
    await processor.onModuleDestroy()
    await dlq.onModuleDestroy()
  })
})
