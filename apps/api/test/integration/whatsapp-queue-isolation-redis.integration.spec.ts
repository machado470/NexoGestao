import { Queue, QueueEvents } from 'bullmq'
import IORedis from 'ioredis'
import { randomUUID } from 'crypto'
import { WhatsAppProcessor } from '../../src/queue/processors/whatsapp.processor'
import { QUEUE_NAMES, WHATSAPP_QUEUE_JOB_NAMES } from '../../src/queue/queue.constants'

const suite=process.env.RUN_CAPACITY_REDIS_INTEGRATION==='true'?describe:describe.skip
suite('WhatsApp isolated inbound queue / real Redis',()=>{
  it('processes other tenants while outbound is paused and a tenant yields its job',async()=>{
    const connection=new IORedis(process.env.CAPACITY_TEST_REDIS_URL!,{maxRetriesPerRequest:null})
    const outbound=new Queue(QUEUE_NAMES.WHATSAPP,{connection})
    const inbound=new Queue(QUEUE_NAMES.WHATSAPP_INBOUND,{connection})
    const events=new QueueEvents(QUEUE_NAMES.WHATSAPP_INBOUND,{connection})
    const seen:string[]=[]
    let delayed=false
    const limits={enforceLimit:jest.fn(async ({orgId})=>{
      if(orgId==='tenant-a'&&!delayed){delayed=true;return {allowed:false}}
      return {allowed:true}
    })}
    const domain={processPersistedInboundWebhook:jest.fn(async ({orgId})=>{seen.push(orgId);return {processed:1}})}
    const queues={updateJobStatus:jest.fn(),processJobWithTracing:(_q:any,_n:any,_d:any,run:()=>any)=>run()}
    const metrics:any={incInboundWebhookStarted:()=>{},incInboundWebhookCompleted:()=>{},observeProcessingDuration:()=>{}}
    const processor=new WhatsAppProcessor(connection,domain as any,queues as any,metrics,{observeDuration:()=>{}} as any,limits as any)
    const jobs:any[]=[]
    try{
      const counts=await inbound.getJobCounts('waiting','active','delayed')
      expect(Object.values(counts).reduce((sum,count)=>sum+count,0)).toBe(0)
      await outbound.pause();await events.waitUntilReady();await processor.onModuleInit()
      for(const orgId of ['tenant-a','tenant-b'])jobs.push(await inbound.add(WHATSAPP_QUEUE_JOB_NAMES.INBOUND_WEBHOOK,{orgId,webhookEventId:randomUUID(),provider:'mock',traceId:randomUUID()},{jobId:randomUUID()}))
      await Promise.all(jobs.map(job=>job.waitUntilFinished(events,15000)))
      expect(seen).toEqual(['tenant-b','tenant-a'])
      expect(delayed).toBe(true)
      expect((await inbound.getJob(jobs[0].id))?.attemptsMade).toBe(1)
      expect(await outbound.isPaused()).toBe(true)
    }finally{
      await processor.onModuleDestroy()
      for(const job of jobs)await job.remove().catch(()=>{})
      await outbound.resume();await events.close();await inbound.close();await outbound.close();await connection.quit()
    }
  },30000)
})
