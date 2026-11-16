import { CustomersService } from './customers.service'

describe('Customer page navigation',()=>{
  it('locates an older deep-linked customer without fetching the whole collection',async()=>{
    const customer={id:'old',createdAt:new Date('2026-01-01')}
    const db={customer:{findFirst:jest.fn().mockResolvedValue(customer),count:jest.fn().mockResolvedValueOnce(500).mockResolvedValueOnce(501),findMany:jest.fn().mockResolvedValue([customer])}}
    const result=await new CustomersService(db as any,null!,null!,null!,null!,null!,null!).list('org',{page:1,limit:8,focusId:'old'})
    expect(result.meta).toMatchObject({page:63,total:501,pages:63})
    expect(db.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{orgId:'org'},skip:496,take:8}))
  })
  it('retains tenant, status, search and risk ID restrictions together',async()=>{
    const db={customer:{findFirst:jest.fn().mockResolvedValue(null),count:jest.fn().mockResolvedValue(0),findMany:jest.fn().mockResolvedValue([])}}
    await new CustomersService(db as any,null!,null!,null!,null!,null!,null!).list('org',{page:1,limit:8,active:'active',search:'QA',focusId:'old'},[])
    expect(db.customer.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{AND:[expect.objectContaining({orgId:'org',active:true,id:{in:[]},OR:expect.any(Array)}),{id:'old'}]}}))
    expect(db.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({orgId:'org',active:true,id:{in:[]}})}))
  })
})
