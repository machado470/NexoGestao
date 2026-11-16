function transactionalDouble(db: any) { db.$transaction ??= jest.fn(async (callback: any) => callback(db)); return db }
import { HttpException } from '@nestjs/common'
import { WhatsAppService } from './whatsapp.service'

describe('WhatsApp rejected admission cannot become a delayed send',()=>{
  it('rejects before message creation or conversation state changes',async()=>{
    const db:any={whatsAppConversation:{findFirst:jest.fn().mockResolvedValue({id:'conv'})},whatsAppMessage:{create:jest.fn()}}
    const queue:any={reserveWhatsAppAdmission:jest.fn().mockRejectedValue(new HttpException('limited',429)),addJob:jest.fn()}
    const service=new WhatsAppService(transactionalDouble(db),queue,{} as any,{} as any,{} as any,{} as any,{lockMeterInTransaction: jest.fn(), assertMeterInTransaction: jest.fn(), enforceMeter:jest.fn().mockResolvedValue({allowed:true})} as any,{} as any)
    const touch=jest.spyOn(service as any,'touchConversation')
    await expect(service.enqueueMessage('org',{conversationId:'conv',toPhone:'+5511999999999',content:'Fictício'})).rejects.toMatchObject({status:429})
    expect(db.whatsAppMessage.create).not.toHaveBeenCalled()
    expect(touch).not.toHaveBeenCalled()
    expect(queue.addJob).not.toHaveBeenCalled()
  })
  it('leaves a failed message unchanged when a manual retry has no budget',async()=>{
    const db:any={whatsAppMessage:{findFirst:jest.fn().mockResolvedValue({id:'m',status:'FAILED'}),updateMany:jest.fn()}}
    const queue:any={reserveWhatsAppAdmission:jest.fn().mockRejectedValue(new HttpException('limited',429)),addJob:jest.fn()}
    const service=new WhatsAppService(transactionalDouble(db),queue,{} as any,{} as any,{} as any,{} as any,{} as any,{} as any)
    await expect(service.retryFailedMessage('org','m')).rejects.toMatchObject({status:429})
    expect(db.whatsAppMessage.updateMany).not.toHaveBeenCalled()
    expect(queue.addJob).not.toHaveBeenCalled()
  })
})

describe('Canonical conversation recipient',()=>{
  it('resolves the conversation phone without requiring the client to repeat it',async()=>{
    const db:any={whatsAppConversation:{findFirst:jest.fn().mockResolvedValue({id:'conv',customerId:null,phone:'+5511999999999'})},whatsAppMessage:{create:jest.fn().mockResolvedValue({id:'m',createdAt:new Date()})}}
    const queue:any={reserveWhatsAppAdmission:jest.fn(),addJob:jest.fn()}
    const service=new WhatsAppService(transactionalDouble(db),queue,{incQueuedJobs:jest.fn(),incOutbound:jest.fn()} as any,{} as any,{} as any,{increment:jest.fn()} as any,{lockMeterInTransaction: jest.fn(), assertMeterInTransaction: jest.fn(), enforceMeter:jest.fn().mockResolvedValue({allowed:true})} as any,{} as any)
    jest.spyOn(service as any,'touchConversation').mockResolvedValue(undefined)
    await service.enqueueMessage('org',{conversationId:'conv',content:'Fictício'})
    expect(db.whatsAppConversation.findFirst).toHaveBeenCalledWith({where:{id:'conv',orgId:'org'}})
    expect(db.whatsAppMessage.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({conversationId:'conv',toPhone:'+5511999999999'})}))
    expect(queue.reserveWhatsAppAdmission).toHaveBeenCalledTimes(1)
    expect(queue.addJob).toHaveBeenCalledWith('whatsapp','dispatch-message',expect.any(Object),expect.any(Object),true)
  })
  it('rejects missing tenant conversations before creating messages',async()=>{
    const db:any={whatsAppConversation:{findFirst:jest.fn().mockResolvedValue(null)},whatsAppMessage:{create:jest.fn()}}
    const service=new WhatsAppService(transactionalDouble(db),{} as any,{} as any,{} as any,{} as any,{} as any,{} as any,{} as any)
    await expect(service.enqueueMessage('org',{conversationId:'other-tenant',content:'Fictício'})).rejects.toMatchObject({status:400})
    expect(db.whatsAppMessage.create).not.toHaveBeenCalled()
  })
  it('rejects an explicit customer that disagrees with the conversation',async()=>{
    const db:any={whatsAppConversation:{findFirst:jest.fn().mockResolvedValue({id:'conv',customerId:'customer-a',phone:'+5511999999999'})},whatsAppMessage:{create:jest.fn()}}
    const service=new WhatsAppService(transactionalDouble(db),{} as any,{} as any,{} as any,{} as any,{} as any,{} as any,{} as any)
    await expect(service.enqueueMessage('org',{conversationId:'conv',customerId:'customer-b',content:'Fictício'})).rejects.toMatchObject({status:400})
    expect(db.whatsAppMessage.create).not.toHaveBeenCalled()
  })
})
