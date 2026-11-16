import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { ListConversationsQueryDto } from './dto/whatsapp.dto'

describe('Inbox filters HTTP validation', () => {
  it('accepts advertised filters without forbidding them as unknown properties', async () => {
    const input=plainToInstance(ListConversationsQueryDto,{search:'Contato QA',status:'WAITING_CUSTOMER',priority:'HIGH',contextType:'CUSTOMER',customerId:'customer',onlyUnread:'false',limit:'200'})
    expect(await validate(input,{whitelist:true,forbidNonWhitelisted:true})).toEqual([])
    expect(input.onlyUnread).toBe(false)
  })
  it('rejects invalid enums and overlong search terms', async () => {
    const errors=await validate(plainToInstance(ListConversationsQueryDto,{search:'x'.repeat(121),status:'INVALID',onlyUnread:'anything'}),{whitelist:true,forbidNonWhitelisted:true})
    expect(errors.map(x=>x.property).sort()).toEqual(['onlyUnread','search','status'])
  })
})
