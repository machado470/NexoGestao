import { DelayedError } from 'bullmq'
import { WhatsAppProcessor } from './whatsapp.processor'
import { WHATSAPP_QUEUE_JOB_NAMES } from '../queue.constants'

describe('WhatsApp tenant scheduling', () => {
  it('delays excess tenant jobs without sending or consuming retries', async () => {
    const limits={enforceLimit:jest.fn().mockResolvedValue({allowed:false})}
    const queue={processJobWithTracing:jest.fn()}
    const processor=new WhatsAppProcessor({} as any,{} as any,queue as any,{} as any,{} as any,limits as any)
    const job:any={name:WHATSAPP_QUEUE_JOB_NAMES.DISPATCH_MESSAGE,data:{orgId:'org'},moveToDelayed:jest.fn()}
    await expect(processor.processQueuedJob(job,'lock-token')).rejects.toBeInstanceOf(DelayedError)
    expect(job.moveToDelayed).toHaveBeenCalledWith(expect.any(Number),'lock-token')
    expect(queue.processJobWithTracing).not.toHaveBeenCalled()
  })
  it('budgets inbound separately and preserves the actual queue in tracing', async () => {
    const limits={enforceLimit:jest.fn().mockResolvedValue({allowed:true})}
    const queue={processJobWithTracing:jest.fn().mockResolvedValue('ok')}
    const processor=new WhatsAppProcessor({} as any,{} as any,queue as any,{} as any,{} as any,limits as any)
    const job:any={name:WHATSAPP_QUEUE_JOB_NAMES.INBOUND_WEBHOOK,queueName:'whatsapp-inbound',data:{orgId:'org'}}
    expect(await processor.processQueuedJob(job)).toBe('ok')
    expect(limits.enforceLimit).toHaveBeenCalledWith(expect.objectContaining({scope:'whatsapp:inbound-jobs',limit:10,orgId:'org'}))
    expect(queue.processJobWithTracing).toHaveBeenCalledWith('whatsapp-inbound',job.name,job.data,expect.any(Function))
  })
})
