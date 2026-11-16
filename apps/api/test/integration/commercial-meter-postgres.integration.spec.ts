import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { CommercialPolicyService, commercialUsagePeriod } from '../../src/common/commercial/commercial-policy.service'
import { TenantOperationsService } from '../../src/common/tenant-ops/tenant-ops.service'
import { buildDefaultPlanCreateData } from '../../src/common/commercial/default-plan-definitions'
import { WhatsAppService } from '../../src/whatsapp/whatsapp.service'
import { FinanceService } from '../../src/finance/finance.service'
import { ManualPaymentsService } from '../../src/finance/manual-payments.service'
import { TimelineService } from '../../src/timeline/timeline.service'
import { IdempotencyService } from '../../src/common/idempotency/idempotency.service'
import { OutboxService } from '../../src/outbox/outbox.service'

const suite = process.env.RUN_REAL_INTEGRATION === 'true' ? describe : describe.skip
suite('Shared commercial meters / real transactional PostgreSQL', () => {
  jest.setTimeout(60000)
  const db = new PrismaClient(), orgIds: string[] = []
  const policy = () => new CommercialPolicyService(db as any, new TenantOperationsService())
  beforeAll(() => db.$connect())
  afterAll(async () => {
    const where = { orgId: { in: orgIds } }
    await db.operationalOutboxEvent.deleteMany({where}); await db.idempotencyRecord.deleteMany({where}); await db.tenantRateLimitBucket.deleteMany({where}); await db.timelineEvent.deleteMany({where}); await db.payment.deleteMany({where}); await db.charge.deleteMany({where}); await db.whatsAppMessage.deleteMany({where}); await db.whatsAppConversation.deleteMany({where}); await db.customer.deleteMany({where}); await db.subscription.deleteMany({where}); await db.organization.deleteMany({where:{id:{in:orgIds}}}); await db.$disconnect()
  })
  async function fixture() {
    const orgId=randomUUID();orgIds.push(orgId)
    await db.organization.create({data:{id:orgId,name:'Meter QA',slug:orgId}})
    const plan=await db.plan.upsert({where:{name:'FREE'},update:{},create:buildDefaultPlanCreateData('FREE')})
    await db.subscription.create({data:{orgId,planId:plan.id,status:'ACTIVE',currentPeriodStart:new Date(),currentPeriodEnd:new Date(Date.now()+86400000)}})
    const customer=await db.customer.create({data:{orgId,name:'Synthetic customer',phone:'11900000000'}})
    const conversation=await db.whatsAppConversation.create({data:{orgId,customerId:customer.id,phone:'+5511900000000'}})
    return {orgId,customer,conversation,policy:policy()}
  }
  type Fixture=Awaited<ReturnType<typeof fixture>>
  const message=(f:Fixture,createdAt=new Date())=>({orgId:f.orgId,conversationId:f.conversation.id,customerId:f.customer.id,entityId:f.customer.id,entityType:'CUSTOMER' as const,messageType:'MANUAL' as const,direction:'OUTBOUND' as const,toPhone:'+5511900000000',renderedText:'Synthetic, no provider',createdAt})
  const queue=()=>({reserveWhatsAppAdmission:jest.fn(),addJob:jest.fn()})
  const whatsapp=(f:Fixture,q:ReturnType<typeof queue>)=>new WhatsAppService(db as any,q as any,{incQueuedJobs:jest.fn(),incOutbound:jest.fn()} as any,{} as any,{requestId:'meter-QA'} as any,new TenantOperationsService(),policy(),{} as any)
  function finance() {
    const ctx={requestId:'meter-QA'},metrics={increment:jest.fn()},commercial=policy()
    const timeline=new TimelineService(db as any,ctx as any,{dispatchTimelineEvent:jest.fn()} as any)
    const service=new FinanceService(db as any,{} as any,timeline,{track:jest.fn()} as any,ctx as any,new IdempotencyService(db as any,ctx as any,metrics as any),metrics as any,{} as any,new OutboxService(ctx as any))
    return {service,manual:new ManualPaymentsService(service,new TenantOperationsService(db as any),commercial),commercial}
  }
  it('admits only the last message across instances and permits replay at the cap after restart',async()=>{
    const f=await fixture(),q=queue(),limit=(await f.policy.getContext(f.orgId)).limits.message_sends
    await db.whatsAppMessage.createMany({data:Array.from({length:limit-1},()=>message(f))})
    const services=[whatsapp(f,q),whatsapp(f,q)]
    const results=await Promise.allSettled(Array.from({length:8},(_,i)=>services[i%2].enqueueMessage(f.orgId,{conversationId:f.conversation.id,content:'Synthetic',messageKey:randomUUID()})))
    expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1)
    expect(await db.whatsAppMessage.count({where:{orgId:f.orgId}})).toBe(limit)
    expect((await policy().enforceMeter(f.orgId,'message_sends')).allowed).toBe(false)
    const winner=results.find((x):x is PromiseFulfilledResult<any>=>x.status==='fulfilled')!.value
    expect((await whatsapp(f,q).enqueueMessage(f.orgId,{conversationId:f.conversation.id,content:'Synthetic',messageKey:winner.message.messageKey})).created).toBe(false)
    expect(q.addJob).toHaveBeenCalledTimes(1)
  })
  it('deduplicates concurrent message keys within the admission transaction',async()=>{
    const f=await fixture(),q=queue(),messageKey=randomUUID()
    const results=await Promise.all([whatsapp(f,q),whatsapp(f,q)].map(s=>s.enqueueMessage(f.orgId,{conversationId:f.conversation.id,content:'Synthetic',messageKey})))
    expect(results.filter(x=>x.created)).toHaveLength(1);expect(q.addJob).toHaveBeenCalledTimes(1)
    expect(await db.whatsAppMessage.count({where:{orgId:f.orgId}})).toBe(1)
  })
  it('uses UTC half-open calendar periods and excludes inbound/other tenants and process counters',async()=>{
    const f=await fixture(),other=await fixture(),period=commercialUsagePeriod()
    await db.whatsAppMessage.createMany({data:[message(f,new Date(period.start.getTime()-1)),message(f,period.start),message(f,period.end),{...message(f),direction:'INBOUND'},message(other)]})
    const ops=new TenantOperationsService();ops.increment(f.orgId,'whatsapp_queued',999999)
    expect(await new CommercialPolicyService(db as any,ops).enforceMeter(f.orgId,'message_sends')).toMatchObject({allowed:true,used:1})
  })
  it('rolls back failed admission without compensating counter releases',async()=>{
    const f=await fixture()
    await expect(db.$transaction(async tx=>{await f.policy.assertMeterInTransaction(tx,f.orgId,'message_sends');await tx.whatsAppMessage.create({data:{...message(f),customerId:randomUUID()}})})).rejects.toThrow()
    expect((await policy().enforceMeter(f.orgId,'message_sends')).used).toBe(0)
    await db.$transaction(async tx=>{await f.policy.assertMeterInTransaction(tx,f.orgId,'message_sends');await tx.whatsAppMessage.create({data:message(f)})})
    expect((await policy().enforceMeter(f.orgId,'message_sends')).used).toBe(1)
  })
  it('serializes financial creation with its write and idempotent replay consumes no extra slot',async()=>{
    const f=await fixture(),limit=(await f.policy.getContext(f.orgId)).limits.finance_critical_actions
    await db.charge.createMany({data:Array.from({length:limit-1},()=>({orgId:f.orgId,customerId:f.customer.id,amountCents:100,dueDate:new Date()}))})
    const keys=[randomUUID(),randomUUID()]
    const create=(i:number)=>{const {service,commercial}=finance();return service.createCharge({orgId:f.orgId,customerId:f.customer.id,amountCents:100,dueDate:new Date('2026-12-20'),idempotencyKey:keys[i],commercialAdmission:tx=>commercial.assertMeterInTransaction(tx,f.orgId,'finance_critical_actions')})}
    const results=await Promise.allSettled([create(0),create(1)]),winner=results.findIndex(x=>x.status==='fulfilled')
    expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);await create(winner)
    expect((await policy().enforceMeter(f.orgId,'finance_critical_actions')).used).toBe(limit)
  })
  it('rolls back manual settlement at the cap while provider reconciliation remains possible',async()=>{
    const f=await fixture(),{service,manual}=finance(),limit=(await f.policy.getContext(f.orgId)).limits.finance_critical_actions
    const charge=await db.charge.create({data:{orgId:f.orgId,customerId:f.customer.id,amountCents:100,dueDate:new Date()}})
    await db.charge.createMany({data:Array.from({length:limit-1},()=>({orgId:f.orgId,customerId:f.customer.id,amountCents:100,dueDate:new Date()}))})
    await expect(manual.pay(f.orgId,null,charge.id,{method:'CASH',amountCents:100},randomUUID())).rejects.toMatchObject({response:{reasonCode:'plan_limit_reached'}})
    expect((await db.charge.findUniqueOrThrow({where:{id:charge.id}})).status).toBe('PENDING')
    expect(await db.payment.count({where:{orgId:f.orgId}})).toBe(0)
    await service.payCharge({orgId:f.orgId,chargeId:charge.id,method:'CARD',amountCents:100,externalRef:'stripe:pi_'+randomUUID()})
    expect((await policy().enforceMeter(f.orgId,'finance_critical_actions')).used).toBe(limit)
  })
  it('reserves durable automation starts before effects across instances',async()=>{
    const f=await fixture(),limit=(await f.policy.getContext(f.orgId)).limits.automation_executions,event={orgId:f.orgId,action:'EXECUTION_EVENT',description:'Synthetic start',metadata:{eventType:'EXECUTION_STARTED'}}
    await db.timelineEvent.createMany({data:Array.from({length:limit-1},()=>event)})
    const results=await Promise.allSettled([policy(),policy()].map(p=>db.$transaction(async tx=>{await p.assertMeterInTransaction(tx,f.orgId,'automation_executions');await tx.timelineEvent.create({data:event})})))
    expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1)
    expect((await policy().enforceMeter(f.orgId,'automation_executions')).used).toBe(limit)
  })
  it('reports configured-rule capability as unavailable instead of reusing execution counters',async()=>{
    const f=await fixture(),overview=await f.policy.getAdminTenantCommercialOverview(),tenant=overview.tenants.find(x=>x.tenant.id===f.orgId)!
    expect(tenant.usage.configurable_automations).toBe(0);expect(tenant.meterAvailability.configurable_automations).toBe(false)
    expect(await f.policy.enforceMeter(f.orgId,'configurable_automations')).toMatchObject({allowed:false,reasonCode:'commercial_meter_unavailable'})
  })
})
