import Stripe from 'stripe'
import { PaymentsService } from './payments.service'

describe('Signed refund webhooks',()=>{
  const secret='whsec_refund_local_only'
  function fixture(){
    const refunds={record:jest.fn().mockResolvedValue({duplicate:false}),reverse:jest.fn().mockResolvedValue({duplicate:false})}
    const service=new PaymentsService({get:key=>key==='STRIPE_SECRET_KEY'?'sk_test_local_only':key==='STRIPE_WEBHOOK_SECRET'?secret:'test'} as any,{} as any,{} as any,refunds as any)
    const stripe=(service as any).stripe as Stripe
    const refund:any={id:'re_1',status:'succeeded',payment_intent:'pi_1',amount:300,currency:'brl',created:100}
    const retrieve=jest.spyOn(stripe.refunds,'retrieve').mockImplementation(async()=>refund)
    jest.spyOn(stripe.paymentIntents,'retrieve').mockResolvedValue({id:'pi_1',metadata:{orgId:'org',chargeId:'charge'}} as any)
    const send=(type:string,object:any)=>{const payload=JSON.stringify({id:'evt_refund',created:101,type,data:{object}});return service.handleWebhook(Buffer.from(payload),Stripe.webhooks.generateTestHeaderString({payload,secret}))}
    return{refunds,service,stripe,refund,retrieve,send}
  }
  it('resolves authoritative intent metadata and delegates a successful partial refund',async()=>{
    const f=fixture();await f.send('refund.updated',{id:'re_1',metadata:{orgId:'forged'}})
    expect(f.refunds.record).toHaveBeenCalledWith({orgId:'org',chargeId:'charge',paymentIntentId:'pi_1',providerRefundId:'re_1',providerEventId:'evt_refund',amountCents:300,currency:'brl',refundedAt:new Date(100000)})
  })
  it.each(['pending','failed','canceled'])('does not book a %s refund',async status=>{
    const f=fixture();f.refund.status=status;await f.send('refund.updated',{id:'re_1'});expect(f.refunds.record).not.toHaveBeenCalled()
    if(status!=='pending')expect(f.refunds.reverse).toHaveBeenCalled()
  })
  it('routes refund.failed through authoritative reversal handling',async()=>{
    const f=fixture();f.refund.status='failed'
    await f.send('refund.failed',{id:'re_1'})
    expect(f.refunds.reverse).toHaveBeenCalledWith({orgId:'org',chargeId:'charge',paymentIntentId:'pi_1',providerRefundId:'re_1',providerEventId:'evt_refund'})
    expect(f.refunds.record).not.toHaveBeenCalled()
  })
  it('processes the provider list rather than a truncated embedded charge list',async()=>{
    const f=fixture();const page:any={async *[Symbol.asyncIterator](){yield{id:'re_1'};yield{id:'re_2'}}}
    jest.spyOn(f.stripe.refunds,'list').mockReturnValue(page)
    f.retrieve.mockImplementation(async(id:any)=>({...f.refund,id}))
    await f.send('charge.refunded',{id:'ch_1',refunds:{data:[{id:'re_1'}],has_more:true}})
    expect(f.refunds.record).toHaveBeenCalledTimes(2)
  })
  it('propagates ordering/concurrency failures so Stripe can retry',async()=>{
    const f=fixture();f.refunds.record.mockRejectedValue(new Error('payment not yet settled'))
    await expect(f.send('refund.updated',{id:'re_1'})).rejects.toThrow('payment not yet settled')
  })
  it('verifies the signature before reading provider or local state',async()=>{
    const f=fixture();await expect(f.service.handleWebhook(Buffer.from('{}'),'invalid')).rejects.toThrow();expect(f.retrieve).not.toHaveBeenCalled();expect(f.refunds.record).not.toHaveBeenCalled()
  })
})
