import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { ServiceOrderReadService } from '../../src/service-orders/service-order-read.service'

const suite=process.env.RUN_REAL_INTEGRATION==='true'?describe:describe.skip
suite('Paged O.S. filters match canonical decisions / PostgreSQL',()=>{
  const db=new PrismaClient(),orgId=randomUUID(),customerId=randomUUID(),personId=randomUUID()
  const service=new ServiceOrderReadService(db as any)
  beforeAll(async()=>{
    await db.organization.create({data:{id:orgId,name:'QA filtros',slug:orgId}})
    await db.customer.create({data:{id:customerId,orgId,name:'Fictício',phone:'11900000000'}})
    await db.person.create({data:{id:personId,orgId,name:'QA',role:'STAFF'}})
    const past=new Date(Date.now()-86400000),future=new Date(Date.now()+86400000)
    const cases:any[]=[
      {status:'OPEN'}, {status:'OPEN',assignedToPersonId:personId},
      {status:'IN_PROGRESS',assignedToPersonId:personId}, {status:'CANCELED'},
      {status:'DONE',assignedToPersonId:personId},
      {status:'OPEN',assignedToPersonId:personId,scheduledFor:past},
      {status:'OPEN',assignedToPersonId:personId,dueDate:future,scheduledFor:past},
      {status:'DONE',assignedToPersonId:personId,charge:'PAID'},
      {status:'DONE',assignedToPersonId:personId,charge:'PENDING'},
      {status:'IN_PROGRESS',assignedToPersonId:personId,dueDate:future},
      {status:'OPEN',assignedToPersonId:personId,scheduledFor:future},
    ]
    for(const [i,item] of cases.entries()){
      const {charge,...data}=item
      const order=await db.serviceOrder.create({data:{...data,orgId,customerId,title:`Caso ${i}`}})
      if(charge)await db.charge.create({data:{orgId,customerId,serviceOrderId:order.id,amountCents:1000,dueDate:past,status:charge}})
    }
  })
  afterAll(async()=>{await db.charge.deleteMany({where:{orgId}});await db.serviceOrder.deleteMany({where:{orgId}});await db.person.deleteMany({where:{orgId}});await db.customer.deleteMany({where:{orgId}});await db.organization.delete({where:{id:orgId}});await db.$disconnect()})
  it.each(['P0','P1','P2','P3'])('returns the same %s records as the authoritative decision',async priority=>{
    const all=await service.list(orgId,{limit:100})
    const expected=all.data.filter(x=>x.operationalDecision.priority===priority).map(x=>x.id).sort()
    const result=await service.list(orgId,{limit:100,priorityFilter:priority})
    expect(result.data.map(x=>x.id).sort()).toEqual(expected)
    expect(result.pagination.total).toBe(expected.length)
  })
  it('preserves overdue and without-charge semantics across all pages',async()=>{
    const all=await service.list(orgId,{limit:100})
    for(const filter of ['overdue','without_charge']){
      const expected=all.data.filter(x=>filter==='overdue'?x.operationalDecision.isOverdue:x.operationalDecision.nextAction.type==='charge').map(x=>x.id).sort()
      const result=await service.list(orgId,{limit:100,operationalFilter:filter})
      expect(result.data.map(x=>x.id).sort()).toEqual(expected)
    }
  })
})
