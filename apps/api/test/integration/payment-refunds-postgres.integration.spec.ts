import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import Stripe from 'stripe'
import { PaymentRefundsService } from '../../src/finance/payment-refunds.service'
import { TimelineService } from '../../src/timeline/timeline.service'
import { FinanceService } from '../../src/finance/finance.service'
import { ExpensesService } from '../../src/expenses/expenses.service'
import { CustomersService } from '../../src/customers/customers.service'
import { DashboardService } from '../../src/dashboard/dashboard.service'
import { MemoryCacheService } from '../../src/common/cache/memory-cache.service'
import { BillingService } from '../../src/billing/billing.service'

const suite=process.env.RUN_REAL_INTEGRATION==='true'?describe:describe.skip
suite('Refund ledger and subscription reconciliation / real PostgreSQL',()=>{
  const db=new PrismaClient(),orgIds:string[]=[]
  const timeline=new TimelineService(db as any,{requestId:'refund-test'} as any,{dispatchTimelineEvent:jest.fn()} as any)
  const service=()=>new PaymentRefundsService(db as any,timeline)
  beforeAll(()=>db.$connect())
  afterAll(async()=>{
    const scope={orgId:{in:orgIds}}
    await db.paymentRefund.deleteMany({where:scope});await db.timelineEvent.deleteMany({where:scope});await db.auditEvent.deleteMany({where:scope})
    await db.billingEvent.deleteMany({where:{subscription:{orgId:{in:orgIds}}}});await db.subscription.deleteMany({where:scope})
    await db.payment.deleteMany({where:scope});await db.charge.deleteMany({where:scope});await db.customer.deleteMany({where:scope});await db.organization.deleteMany({where:{id:{in:orgIds}}});await db.$disconnect()
  })
  async function fixture(){
    const orgId=randomUUID();orgIds.push(orgId)
    await db.organization.create({data:{id:orgId,name:'Refund QA',slug:orgId,timezone:'America/Sao_Paulo'}})
    const customer=await db.customer.create({data:{orgId,name:'Synthetic refund customer',phone:'11900000000'}})
    const charge=await db.charge.create({data:{orgId,customerId:customer.id,amountCents:1000,status:'PAID',dueDate:new Date('2026-10-20'),paidAt:new Date('2026-10-20')}})
    const paymentIntentId='pi_'+randomUUID()
    const payment=await db.payment.create({data:{orgId,chargeId:charge.id,amountCents:1000,method:'CARD',externalRef:`stripe:${paymentIntentId}`,paidAt:new Date('2026-10-20T12:00:00Z')}})
    const input={orgId,chargeId:charge.id,paymentIntentId,providerRefundId:'re_'+randomUUID(),providerEventId:'evt_'+randomUUID(),amountCents:300,currency:'brl',refundedAt:new Date('2026-11-11T12:00:00Z')}
    return{orgId,customer,charge,payment,input}
  }
  it('records a partial refund once without rewriting settlement, with timeline and audit',async()=>{
    const f=await fixture();expect((await service().record(f.input)).duplicate).toBe(false);expect((await service().record(f.input)).duplicate).toBe(true)
    expect(await db.paymentRefund.count({where:{orgId:f.orgId}})).toBe(1)
    expect((await db.payment.findUniqueOrThrow({where:{id:f.payment.id}})).amountCents).toBe(1000)
    expect((await db.charge.findUniqueOrThrow({where:{id:f.charge.id}})).status).toBe('PAID')
    expect(await db.timelineEvent.count({where:{orgId:f.orgId,action:'PAYMENT_REFUNDED',chargeId:f.charge.id}})).toBe(1)
    expect(await db.auditEvent.count({where:{orgId:f.orgId,action:'PAYMENT_REFUNDED'}})).toBe(1)
  })
  it('deduplicates eight concurrent deliveries across instances',async()=>{
    const f=await fixture(),instances=[service(),service()]
    const results=await Promise.all(Array.from({length:8},(_,i)=>instances[i%2].record(f.input)))
    expect(results.filter(x=>!x.duplicate)).toHaveLength(1)
    expect(await db.paymentRefund.count({where:{orgId:f.orgId}})).toBe(1)
  })
  it('serializes different refunds so the sum never exceeds the original payment',async()=>{
    const f=await fixture()
    const results=await Promise.allSettled([service().record({...f.input,amountCents:700}),service().record({...f.input,providerRefundId:'re_'+randomUUID(),amountCents:600})])
    expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1)
    expect(results.filter(x=>x.status==='rejected')).toHaveLength(1)
    expect((await db.paymentRefund.aggregate({where:{orgId:f.orgId},_sum:{amountCents:true}}))._sum.amountCents).toBeLessThanOrEqual(1000)
  })
  it('supports full refund through partial entries and rejects changed currency/duplicate values',async()=>{
    const f=await fixture();await service().record(f.input)
    await expect(service().record({...f.input,amountCents:301})).rejects.toThrow('divergente')
    await expect(service().record({...f.input,providerRefundId:'re_'+randomUUID(),currency:'USD'})).rejects.toThrow('Moeda')
    await service().record({...f.input,providerRefundId:'re_'+randomUUID(),amountCents:700})
    await expect(service().record({...f.input,providerRefundId:'re_'+randomUUID(),amountCents:1})).rejects.toThrow('excedem')
  })
  it('rejects a foreign organization and retries refund-before-payment ordering',async()=>{
    const f=await fixture(),other=await fixture()
    await expect(service().record({...f.input,orgId:other.orgId})).rejects.toThrow('ainda não conciliado')
    await expect(service().record({...f.input,paymentIntentId:'pi_later'})).rejects.toThrow('ainda não conciliado')
    await db.payment.update({where:{id:f.payment.id},data:{externalRef:'stripe:pi_later'}})
    expect((await service().record({...f.input,paymentIntentId:'pi_later'})).duplicate).toBe(false)
    expect(await db.paymentRefund.count({where:{orgId:other.orgId}})).toBe(0)
  })
  it('enforces organization ownership in the database foreign key too',async()=>{
    const f=await fixture(),other=await fixture()
    await expect(db.paymentRefund.create({data:{orgId:other.orgId,paymentId:f.payment.id,providerRefundId:'re_'+randomUUID(),providerEventId:'evt_test',amountCents:300,currency:'BRL',refundedAt:new Date()}})).rejects.toThrow()
    expect(await db.paymentRefund.count({where:{orgId:other.orgId}})).toBe(0)
  })
  it('rolls the ledger back if canonical history fails to persist',async()=>{
    const f=await fixture(),broken=new PaymentRefundsService(db as any,{logInTransaction:async()=>{throw new Error('history failed')}} as any)
    await expect(broken.record(f.input)).rejects.toThrow('history failed')
    expect(await db.paymentRefund.count({where:{orgId:f.orgId}})).toBe(0)
  })
  it('nets cash-flow periods and invalidates a cached dashboard after each refund',async()=>{
    const f=await fixture()
    const dashboard=new DashboardService(db as any,new MemoryCacheService(),{getAutoScore:async()=>({score:0,level:'A'})} as any)
    expect((await dashboard.getMetrics(f.orgId)).paidRevenueInCents).toBe(1000)
    await service().record(f.input)
    const finance=new FinanceService(db as any,{} as any,{} as any,{} as any,{} as any,{} as any,{} as any,{} as any,{} as any)
    expect((await finance.overview(f.orgId)).paidAmountCents).toBe(700)
    expect((await finance.getChargeStats(f.orgId)).paid.amountCents).toBe(700)
    expect(await finance.getCharge(f.orgId,f.charge.id)).toMatchObject({paidAmountCents:1000,refundedAmountCents:300,netReceivedAmountCents:700,balanceCents:0})
    const monthly=await new ExpensesService(db as any,timeline).getMonthlyFinancialResult(f.orgId,'2026-11')
    expect(monthly).toMatchObject({totalRevenueMonth:0,refundedAmountMonth:300,netRevenueMonth:-300,netMonthlyResult:-300})
    const months=await finance.getRevenueByMonth(f.orgId)
    expect(months.find(x=>x.month==='2026-11')).toMatchObject({amountCents:0,refundedAmountCents:300,netAmountCents:-300})
    const customer=await new CustomersService(db as any,{} as any,{} as any,{} as any,{} as any,{} as any,{} as any).workspace(f.orgId,f.customer.id)
    expect(customer.totalSpentCents).toBe(700)
    expect((await dashboard.getMetrics(f.orgId)).paidRevenueInCents).toBe(700)
    await service().record({...f.input,providerRefundId:'re_'+randomUUID(),amountCents:700})
    expect((await dashboard.getMetrics(f.orgId)).paidRevenueInCents).toBe(0)
  })
  it('reverses a failed refund once across instances without deleting the original evidence',async()=>{
    const f=await fixture(),dashboard=new DashboardService(db as any,new MemoryCacheService(),{getAutoScore:async()=>({score:0,level:'A'})} as any)
    await service().record(f.input)
    expect((await dashboard.getMetrics(f.orgId)).paidRevenueInCents).toBe(700)
    const results=await Promise.all(Array.from({length:6},()=>service().reverse({...f.input,providerEventId:'evt_failure'})))
    expect(results.filter(x=>!x.duplicate)).toHaveLength(1)
    const original=await db.paymentRefund.findUniqueOrThrow({where:{providerRefundId:f.input.providerRefundId}})
    expect(original.amountCents).toBe(300);expect(original.reversedAt).not.toBeNull()
    expect(await db.timelineEvent.count({where:{orgId:f.orgId,action:'PAYMENT_REFUND_REVERSED'}})).toBe(1)
    expect((await dashboard.getMetrics(f.orgId)).paidRevenueInCents).toBe(1000)
    await expect(service().record(f.input)).rejects.toThrow('conciliação')
    await service().record({...f.input,providerRefundId:'re_'+randomUUID(),amountCents:1000})
    const finance=new FinanceService(db as any,{} as any,{} as any,{} as any,{} as any,{} as any,{} as any,{} as any,{} as any)
    expect((await finance.overview(f.orgId)).paidAmountCents).toBe(0)
  })
  it('does not create financial entries for a failed refund that was never booked',async()=>{
    const f=await fixture()
    expect((await service().reverse(f.input)).duplicate).toBe(true)
    expect(await db.paymentRefund.count({where:{orgId:f.orgId}})).toBe(0)
    expect(await db.timelineEvent.count({where:{orgId:f.orgId}})).toBe(0)
  })
  it('credits a reversal in its own month while preserving the original refund month',async()=>{
    const f=await fixture(),now=new Date(),previousDate=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,15,12)),previousMonth=previousDate.toISOString().slice(0,7),currentMonth=now.toISOString().slice(0,7)
    await db.organization.update({where:{id:f.orgId},data:{timezone:'UTC'}})
    await db.payment.update({where:{id:f.payment.id},data:{paidAt:previousDate}})
    await service().record({...f.input,refundedAt:previousDate})
    await service().reverse(f.input)
    const reports=new ExpensesService(db as any,timeline)
    expect(await reports.getMonthlyFinancialResult(f.orgId,previousMonth)).toMatchObject({totalRevenueMonth:1000,netRevenueMonth:700})
    expect(await reports.getMonthlyFinancialResult(f.orgId,currentMonth)).toMatchObject({totalRevenueMonth:0,refundedAmountMonth:-300,netRevenueMonth:300})
  })
  it('keeps a new unpaid checkout on FREE and promotes only after provider-confirmed activation',async()=>{
    const f=await fixture(),secret='whsec_pending_local_only'
    const free=await db.plan.upsert({where:{name:'FREE'},update:{},create:{name:'FREE',displayName:'Free',priceCents:0}})
    const pro=await db.plan.upsert({where:{name:'PRO'},update:{},create:{name:'PRO',displayName:'Pro',priceCents:19900}})
    const billing=new BillingService(db as any,{get:key=>key==='STRIPE_WEBHOOK_SECRET'?secret:key==='STRIPE_PRICE_PRO'?'price_pro':'test'} as any,{} as any)
    const stripe=new Stripe('sk_test_local_only',{apiVersion:'2024-06-20'})
    const provider:any={id:'sub_'+f.orgId,status:'incomplete',customer:'cus_pending',current_period_start:100,current_period_end:300,metadata:{orgId:f.orgId},items:{data:[{price:{id:'price_pro'}}]}}
    jest.spyOn(stripe.subscriptions,'retrieve').mockImplementation(async()=>provider);(billing as any).stripe=stripe
    const deliver=async(type:string,object:object)=>{const payload=JSON.stringify({id:'evt_'+randomUUID(),created:250,type,data:{object}});return billing.handleWebhook(Buffer.from(payload),Stripe.webhooks.generateTestHeaderString({payload,secret}))}
    await deliver('checkout.session.completed',{mode:'subscription',payment_status:'unpaid',subscription:provider.id,metadata:{orgId:f.orgId,planName:'PRO'}})
    expect(await db.subscription.findUniqueOrThrow({where:{orgId:f.orgId}})).toMatchObject({planId:free.id,status:'SUSPENDED'})
    provider.status='active'
    await deliver('invoice.paid',{subscription:provider.id,amount_paid:19900})
    expect(await db.subscription.findUniqueOrThrow({where:{orgId:f.orgId}})).toMatchObject({planId:pro.id,status:'ACTIVE'})
  })
  it('does not block ordinary tenant inserts while the provider response is pending',async()=>{
    const f=await fixture(),secret='whsec_lock_local_only'
    const plan=await db.plan.upsert({where:{name:'FREE'},update:{},create:{name:'FREE',displayName:'Free',priceCents:0}})
    const external='sub_'+f.orgId
    await db.subscription.create({data:{orgId:f.orgId,planId:plan.id,status:'ACTIVE',billingExternalRef:external,currentPeriodStart:new Date(100000),currentPeriodEnd:new Date(300000)}})
    const billing=new BillingService(db as any,{get:key=>key==='STRIPE_WEBHOOK_SECRET'?secret:'test'} as any,{} as any)
    const stripe=new Stripe('sk_test_local_only',{apiVersion:'2024-06-20'})
    let release!:()=>void,entered!:()=>void
    const pending=new Promise<void>(resolve=>{release=resolve}),reading=new Promise<void>(resolve=>{entered=resolve})
    jest.spyOn(stripe.subscriptions,'retrieve').mockImplementation(async()=>{entered();await pending;return {id:external,status:'active',customer:'cus_1',current_period_start:100,current_period_end:300,metadata:{},items:{data:[]}} as any})
    ;(billing as any).stripe=stripe
    const payload=JSON.stringify({id:'evt_'+randomUUID(),type:'invoice.paid',created:250,data:{object:{subscription:external,amount_paid:0}}})
    const reconciliation=billing.handleWebhook(Buffer.from(payload),Stripe.webhooks.generateTestHeaderString({payload,secret}))
    await reading
    let timer:ReturnType<typeof setTimeout>|undefined
    try{
      const inserted=await Promise.race([db.customer.create({data:{orgId:f.orgId,name:'Concurrent insert',phone:'11900000001'}}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('tenant insert blocked by billing')),3000)})])
      expect(inserted.orgId).toBe(f.orgId)
    }finally{if(timer)clearTimeout(timer);release();await reconciliation}
  })
  it('reconciles duplicate subscription invoices under a tenant lock without reactivating cancellation',async()=>{
    const f=await fixture(),secret='whsec_postgres_local_only'
    const plan=await db.plan.upsert({where:{name:'FREE'},update:{},create:{name:'FREE',displayName:'Free',priceCents:0}})
    await db.subscription.create({data:{orgId:f.orgId,planId:plan.id,status:'CANCELED',billingExternalRef:'sub_'+f.orgId,currentPeriodStart:new Date(100000),currentPeriodEnd:new Date(300000),billingProviderEventAt:new Date(250000)}})
    const make=()=>{
      const service=new BillingService(db as any,{get:key=>key==='STRIPE_WEBHOOK_SECRET'?secret:'test'} as any,{} as any)
      const stripe=new Stripe('sk_test_local_only',{apiVersion:'2024-06-20'})
      jest.spyOn(stripe.subscriptions,'retrieve').mockResolvedValue({id:'sub_'+f.orgId,status:'canceled',customer:'cus_1',canceled_at:250,current_period_start:100,current_period_end:300,metadata:{},items:{data:[]}} as any)
      ;(service as any).stripe=stripe;return service
    }
    const payload=JSON.stringify({id:'evt_'+randomUUID(),type:'invoice.paid',created:150,data:{object:{subscription:'sub_'+f.orgId,amount_paid:1000}}})
    const signature=Stripe.webhooks.generateTestHeaderString({payload,secret})
    const results=await Promise.all([make().handleWebhook(Buffer.from(payload),signature),make().handleWebhook(Buffer.from(payload),signature)])
    expect(results.filter(x=>x.processed)).toHaveLength(1)
    expect((await db.subscription.findUniqueOrThrow({where:{orgId:f.orgId}})).status).toBe('CANCELED')
    expect(await db.billingEvent.count({where:{subscription:{orgId:f.orgId}}})).toBe(1)
  })
})
