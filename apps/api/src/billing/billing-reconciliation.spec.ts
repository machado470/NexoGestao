import Stripe from 'stripe'
import { BillingService } from './billing.service'

const secret = 'whsec_reconciliation_local_only'
describe('Subscription reconciliation uses current provider authority', () => {
  function fixture() {
    const current: any = { id:'local',orgId:'org',planId:'plan',billingExternalRef:'sub_current',billingProviderEventAt:new Date(200000),currentPeriodStart:new Date(100000),currentPeriodEnd:new Date(300000) }
    const tx: any = { $queryRaw:jest.fn().mockResolvedValue([{id:'org'}]),billingEvent:{findUnique:jest.fn().mockResolvedValue(null),create:jest.fn().mockResolvedValue({id:'event'})},plan:{findUnique:jest.fn().mockResolvedValue({id:'plan',priceCents:9900})},subscription:{findUnique:jest.fn(async()=>current),findFirst:jest.fn(async()=>current),upsert:jest.fn(async({create})=>({...current,...create})),update:jest.fn(async({data})=>({...current,...data}))} }
    const db={...tx,$transaction:jest.fn(callback=>callback(tx))}
    const service=new BillingService(db as any,{get:key=>key==='STRIPE_WEBHOOK_SECRET'?secret:key==='STRIPE_PRICE_PRO'?'price_pro':'test'} as any,{} as any)
    const provider:any={id:'sub_current',status:'active',customer:'cus_current',current_period_start:100,current_period_end:300,items:{data:[{price:{id:'price_pro'}}]},metadata:{orgId:'org'}}
    const stripe=new Stripe('sk_test_local_only',{apiVersion:'2024-06-20'})
    const retrieve=jest.spyOn(stripe.subscriptions,'retrieve').mockImplementation(async()=>provider)
    ;(service as any).stripe=stripe
    const send=async(type:string,object:object,created=250)=>{const payload=JSON.stringify({id:`evt_${type}_${created}`,type,created,data:{object}});return service.handleWebhook(Buffer.from(payload),Stripe.webhooks.generateTestHeaderString({payload,secret}))}
    const checkout={mode:'subscription',payment_status:'unpaid',metadata:{orgId:'org',planName:'PRO'},subscription:'sub_current',customer:'cus_current'}
    return {service,tx,current,provider,retrieve,send,checkout}
  }
  it.each(['incomplete','unpaid','past_due'])('does not activate unpaid checkout when provider state is %s',async status=>{
    const f=fixture();f.provider.status=status
    await f.send('checkout.session.completed',f.checkout)
    expect(f.tx.subscription.upsert.mock.calls[0][0].create.status).not.toBe('ACTIVE')
    expect(f.tx.billingEvent.create.mock.calls[0][0].data).toMatchObject({type:'ADJUSTMENT',amountCents:0})
  })
  it('binds a new unpaid subscription to FREE without granting paid quotas',async()=>{
    const f=fixture();f.provider.status='incomplete';f.tx.subscription.findUnique.mockResolvedValue(null)
    f.tx.plan.findUnique.mockImplementation(async({where})=>({id:where.name,priceCents:0}))
    await f.send('checkout.session.completed',f.checkout)
    expect(f.tx.subscription.upsert.mock.calls[0][0].create).toMatchObject({planId:'FREE',status:'SUSPENDED'})
  })
  it('preserves an existing subscription when a new upgrade checkout is pending',async()=>{
    const f=fixture();f.provider.id='sub_pending';f.provider.status='incomplete'
    await f.send('checkout.session.completed',{...f.checkout,subscription:'sub_pending'},300)
    expect(f.tx.subscription.upsert).not.toHaveBeenCalled()
  })
  it('uses the actual trial and provider billing period instead of inventing 30 days',async()=>{
    const f=fixture();f.provider.status='trialing'
    await f.send('checkout.session.completed',{...f.checkout,payment_status:'no_payment_required'})
    expect(f.tx.subscription.upsert.mock.calls[0][0].create).toMatchObject({status:'TRIALING',currentPeriodStart:new Date(100000),currentPeriodEnd:new Date(300000)})
  })
  it('does not reactivate canceled subscription after an old paid invoice',async()=>{
    const f=fixture();f.provider.status='canceled';f.provider.canceled_at=240
    await f.send('invoice.paid',{subscription:'sub_current',amount_paid:9900},150)
    expect(f.tx.subscription.update.mock.calls[0][0].data).toMatchObject({status:'CANCELED',billingProviderEventAt:new Date(200000)})
    expect(f.tx.billingEvent.create.mock.calls[0][0].data).toMatchObject({type:'PAYMENT',amountCents:9900,status:'COMPLETED'})
  })
  it('does not downgrade a recovered subscription from an old invoice failure',async()=>{
    const f=fixture();await f.send('invoice.payment_failed',{subscription:'sub_current',amount_due:9900},150)
    expect(f.tx.subscription.update.mock.calls[0][0].data.status).toBe('ACTIVE')
  })
  it('preserves a newer external association when an older checkout arrives',async()=>{
    const f=fixture();f.provider.id='sub_old'
    expect(await f.send('checkout.session.completed',{...f.checkout,subscription:'sub_old'},150)).toMatchObject({processed:false})
    expect(f.tx.subscription.upsert).not.toHaveBeenCalled()
  })
  it('retries rather than activating from payload when provider is unavailable',async()=>{
    const f=fixture();f.retrieve.mockRejectedValue(new Error('provider unavailable'))
    await expect(f.send('checkout.session.completed',f.checkout)).rejects.toThrow('provider unavailable')
    expect(f.tx.subscription.upsert).not.toHaveBeenCalled();expect(f.tx.billingEvent.create).not.toHaveBeenCalled()
  })
  it('does not invent a billing period when the provider omits it',async()=>{
    const f=fixture();delete f.provider.current_period_end
    await expect(f.send('checkout.session.completed',f.checkout)).rejects.toThrow('período')
    expect(f.tx.subscription.upsert).not.toHaveBeenCalled()
  })
  it('rejects a provider subscription bound to another organization',async()=>{
    const f=fixture();f.provider.metadata.orgId='other'
    await expect(f.send('checkout.session.completed',f.checkout)).rejects.toThrow('outra organização')
    expect(f.tx.subscription.upsert).not.toHaveBeenCalled()
  })
})
