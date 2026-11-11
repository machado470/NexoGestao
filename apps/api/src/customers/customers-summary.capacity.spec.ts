import { CustomersOperationalSummaryService } from './customers-operational-summary.service'

describe('Customer portfolio capacity', () => {
  it('evaluates a risky customer beyond 500 while bounding each query', async () => {
    const customers = Array.from({ length: 501 }, (_, i) => ({ id: `customer-${i}`, name: `Fictício ${i}`, active: true, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') }))
    const db: any = { customer: { findMany: jest.fn(async ({cursor, take}) => customers.slice(cursor ? 500 : 0, (cursor ? 500 : 0) + take)) } }
    for (const key of ['charge', 'payment', 'serviceOrder', 'appointment', 'whatsAppMessage', 'whatsAppConversation', 'timelineEvent']) db[key] = { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) }
    db.charge.findMany.mockImplementation(async ({where}) => where.customerId.in.includes('customer-500') ? [{id: 'charge', customerId: 'customer-500', status: 'OVERDUE', amountCents: 100000, payments: []}] : [])
    const result = await new CustomersOperationalSummaryService(db).getSummary('org', new Date('2026-11-11'))
    expect(result.portfolio.totalCustomers).toBe(501)
    const projected = await new CustomersOperationalSummaryService(db).getSummaryPage('org', ['customer-500', 'other-tenant'], new Date('2026-11-11'))
    expect(projected.portfolio).toEqual(result.portfolio)
    expect(projected.customers.map(customer => customer.customerId)).toEqual(['customer-500'])
    expect(result.customers.find(x => x.customerId === 'customer-500')?.riskScore).toBeGreaterThan(0)
    expect(db.customer.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: {orgId:'org'}, take: 500, cursor: {id:'customer-499'}, skip:1 }))
    for (const key of ['charge', 'payment', 'serviceOrder', 'appointment', 'timelineEvent']) {
      expect(db[key].findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1000, orderBy: {id:'asc'} }))
    }
  })
  it('aggregates historical message counts without transferring individual messages', async () => {
    const db: any = { customer: {findMany: jest.fn().mockResolvedValue([{id:'customer',name:'Fictício',active:true}])} }
    for (const key of ['charge', 'payment', 'serviceOrder', 'appointment', 'whatsAppMessage', 'whatsAppConversation', 'timelineEvent']) db[key] = { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) }
    db.whatsAppMessage.groupBy.mockResolvedValue([{customerId:'customer',_count:{_all:1001}}])
    const result = await new CustomersOperationalSummaryService(db).getSummary('org')
    expect(db.whatsAppMessage.findMany).not.toHaveBeenCalled()
    expect(db.whatsAppMessage.groupBy).toHaveBeenCalledWith({by:['customerId'],where:{orgId:'org',customerId:{in:['customer']},status:'FAILED'},_count:{_all:true}})
    expect(result.customers[0].breakdown.find(x=>x.code==='MESSAGE_FAILURES')?.value).toBe(1001)
  })
  it('preserves canonical event evidence and counts across multiple related-data batches', async () => {
    const db: any = { customer: {findMany: jest.fn().mockResolvedValue([{id:'customer',name:'Fictício',active:true}])} }
    for (const key of ['charge', 'payment', 'serviceOrder', 'appointment', 'whatsAppMessage', 'whatsAppConversation', 'timelineEvent']) db[key] = { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) }
    db.timelineEvent.findMany.mockResolvedValueOnce(Array.from({length:1000}, (_,i)=>({id:`event-${i}`,customerId:'customer',action:'MESSAGE_FAILED'}))).mockResolvedValueOnce([{id:'last',customerId:'customer',action:'MESSAGE_FAILED'}])
    const result = await new CustomersOperationalSummaryService(db).getSummary('org')
    expect(result.customers[0].factors.canonicalTimelineEvents).toHaveLength(1001)
    expect(result.customers[0].factors.canonicalCriticalTimelineEvents).toBe(1001)
    expect(result.customers[0].breakdown.find(x=>x.code==='CANONICAL_CRITICAL_TIMELINE_EVENTS')?.value).toBe(1001)
  })

})
