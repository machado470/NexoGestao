import { QueueService } from './queue.service'

describe('WhatsApp admission budgets',()=>{
  function setup(allowed:boolean,existing?:any){
    const budgets={enforceLimit:jest.fn().mockResolvedValue({allowed})}
    const queue={getJob:jest.fn().mockResolvedValue(existing),add:jest.fn().mockResolvedValue({id:'new'})}
    const service=new QueueService({} as any,{} as any,{increment:jest.fn()} as any,{} as any,budgets as any)
    jest.spyOn(service,'ensureEnabled').mockResolvedValue(true)
    jest.spyOn(service,'getQueue').mockReturnValue(queue as any)
    return {service,queue,budgets}
  }
  it('blocks excess admission before adding work while retaining a retryable response',async()=>{
    const {service,queue,budgets}=setup(false)
    await expect(service.addJob('whatsapp','dispatch-message',{orgId:'org'},{jobId:'unique'})).rejects.toMatchObject({status:429})
    expect(queue.add).not.toHaveBeenCalled()
    expect(budgets.enforceLimit).toHaveBeenCalledWith(expect.objectContaining({orgId:'org',scope:'whatsapp:enqueue',limit:60}))
  })
  it('does not charge idempotent re-enqueues another admission slot',async()=>{
    const existing={id:'existing'}, {service,budgets}=setup(false,existing)
    expect(await service.addJob('whatsapp','dispatch-message',{orgId:'org'},{jobId:'existing'})).toBe(existing)
    expect(budgets.enforceLimit).not.toHaveBeenCalled()
  })
  it('does not apply outbound admission limits to durable inbound webhooks',async()=>{
    const {service,queue,budgets}=setup(false)
    await service.addJob('whatsapp-inbound','inbound-webhook',{orgId:'org'})
    expect(queue.add).toHaveBeenCalled()
    expect(budgets.enforceLimit).not.toHaveBeenCalled()
  })
})
