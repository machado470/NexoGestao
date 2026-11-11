import { WhatsAppConversationReadService } from './whatsapp-conversation-read.service'

describe('Conversation message pagination', () => {
  it('returns a bounded page and preserves the continuation cursor', async () => {
    const rows=Array.from({length:51},(_,i)=>({id:`message-${i}`}))
    const db={whatsAppMessage:{findMany:jest.fn().mockResolvedValue(rows)}}
    const result=await new WhatsAppConversationReadService(db as any).getConversationMessagesPage('org','conversation')
    expect(result.items).toHaveLength(50)
    expect(result.nextCursor).toBe('message-49')
    expect(db.whatsAppMessage.findMany).toHaveBeenCalledWith({where:{orgId:'org',conversationId:'conversation'},orderBy:[{createdAt:'desc'},{id:'desc'}],take:51})
  })
  it('uses cursor, tenant, conversation and stable ordering on older pages', async () => {
    const db={whatsAppMessage:{findMany:jest.fn().mockResolvedValue([{id:'last'}])}}
    const service=new WhatsAppConversationReadService(db as any)
    expect(await service.getConversationMessagesPage('org','conversation',{cursor:'cursor',limit:1000})).toEqual({items:[{id:'last'}],nextCursor:null})
    expect(db.whatsAppMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({take:101,cursor:{id:'cursor'},skip:1,where:{orgId:'org',conversationId:'conversation'}}))
    expect(await service.getMessages('org','conversation')).toEqual([{id:'last'}])
  })
})
