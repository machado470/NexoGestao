import { getOptionsToken } from '@nestjs/throttler'
import { PrismaClient } from '@prisma/client'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { PrismaService } from '../../src/prisma/prisma.service'
import { CustomersService } from '../../src/customers/customers.service'
import { FinanceService } from '../../src/finance/finance.service'
import { AuditService } from '../../src/audit/audit.service'

const suite = process.env.RUN_REAL_INTEGRATION === 'true' ? describe : describe.skip
suite('Privacy export minimization and authorization / HTTP + PostgreSQL', () => {
  jest.setTimeout(90000)
  let app: INestApplication, db: PrismaService
  const orgA=randomUUID(),orgB=randomUUID(),orgIds=[orgA,orgB],users=new Map<string,string>(),customers=[randomUUID(),randomUUID(),randomUUID()]
  const jwt=new JwtService({secret:process.env.JWT_SECRET})
  const paths=['/customers/export','/finance/charges/export']
  const auth=(role='ADMIN')=>({Authorization:'Bearer '+jwt.sign({sub:users.get(role),personId:users.get(role),orgId:orgA,role,sessionVersion:0})})
  beforeAll(async()=>{
    const module=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(getOptionsToken()).useValue([{ttl:60000,limit:1000}]).compile();app=module.createNestApplication();app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));await app.init();db=app.get(PrismaService)
    await db.organization.createMany({data:orgIds.map(id=>({id,slug:id,name:'Privacy synthetic QA'}))})
    for(const role of ['ADMIN','MANAGER','STAFF','VIEWER'] as const){const id=randomUUID();users.set(role,id);await db.user.create({data:{id,orgId:orgA,email:`${id}@test.invalid`,role,active:true}});await db.person.create({data:{id,orgId:orgA,userId:id,name:'Privacy QA',role:'TECH'}})}
    await db.customer.createMany({data:[{id:customers[0],orgId:orgA,name:'Subject Alpha',phone:'11900000001',email:'alpha@test.invalid',notes:'REVIEW_ONLY_PRIVATE_NOTE',cpfCnpj:'11111111111'},{id:customers[1],orgId:orgA,name:'Other subject Beta',phone:'11900000002',email:'beta@test.invalid'},{id:customers[2],orgId:orgB,name:'Foreign subject Gamma',phone:'11900000003',email:'gamma@test.invalid'}]})
    await db.charge.createMany({data:[{orgId:orgA,customerId:customers[0],amountCents:100,dueDate:new Date()},{orgId:orgA,customerId:customers[1],amountCents:200,dueDate:new Date()},{orgId:orgB,customerId:customers[2],amountCents:300,dueDate:new Date()}]})
  })
  afterAll(async()=>{
    await app?.close(); await db?.$disconnect()
    const cleanup=new PrismaClient(),where={orgId:{in:orgIds}}
    try{
      await cleanup.timelineEvent.deleteMany({where});await cleanup.auditEvent.deleteMany({where});await cleanup.subscription.deleteMany({where});await cleanup.usageMetric.deleteMany({where});await cleanup.idempotencyRecord.deleteMany({where});await cleanup.tenantRateLimitBucket.deleteMany({where});await cleanup.charge.deleteMany({where});await cleanup.customer.deleteMany({where});await cleanup.person.deleteMany({where});await cleanup.user.deleteMany({where});await cleanup.organization.deleteMany({where:{id:{in:orgIds}}})
    }finally{await cleanup.$disconnect()}
  })
  it.each(paths)('%s rejects anonymous export before the request burst',async path=>{await request(app.getHttpServer()).get(path).expect(401)})
  it.each(paths)('%s preserves the organization export when no subject is selected',async path=>{
    const res=await request(app.getHttpServer()).get(path).set(auth()).expect(200)
    expect(res.headers['content-type']).toContain('text/csv');expect(res.headers['cache-control']).toBe('no-store')
    expect(res.text).toContain('Subject Alpha');expect(res.text).toContain('Other subject Beta');expect(res.text).not.toContain('Foreign subject Gamma');expect(res.text).not.toContain('REVIEW_ONLY_PRIVATE_NOTE');expect(res.text).not.toContain('11111111111')
  })
  it.each(paths)('%s exports only the selected customer and ignores forged tenant selection',async path=>{
    const res=await request(app.getHttpServer()).get(path+`?customerId=${customers[0]}&orgId=${orgB}`).set(auth()).set('x-org-id',orgB).expect(200)
    expect(res.text).toContain('Subject Alpha');expect(res.text).not.toContain('Other subject Beta');expect(res.text).not.toContain('Foreign subject Gamma')
    expect(res.headers['cache-control']).toBe('no-store')
  })
  it.each(paths)('%s rejects foreign and missing subject identifiers without disclosing records',async path=>{
    for(const id of [customers[2],randomUUID()]){const res=await request(app.getHttpServer()).get(path+'?customerId='+id).set(auth()).expect(404);expect(res.text).not.toContain('Foreign subject Gamma')}
  })
  it.each(paths)('%s rejects invalid, blank and repeated subject query parameters',async path=>{
    for(const query of ['customerId=invalid','customerId=',`customerId=${customers[0]}&customerId=${customers[1]}`])await request(app.getHttpServer()).get(path+'?'+query).set(auth()).expect(400)
  })
  it.each(paths)('%s keeps manager permission and rejects staff and viewer exports',async path=>{
    await request(app.getHttpServer()).get(path+'?customerId='+customers[0]).set(auth('MANAGER')).expect(200)
    for(const role of ['STAFF','VIEWER'])await request(app.getHttpServer()).get(path).set(auth(role)).expect(403)
  })
  it('records only scope, actor and counts in audit, without copying personal CSV data',async()=>{
    const events=await db.auditEvent.findMany({where:{orgId:orgA,action:{in:['CUSTOMERS_EXPORTED','CHARGES_EXPORTED']}}})
    expect(events.length).toBeGreaterThanOrEqual(6)
    expect(events.some(x=>x.entityId===customers[0]&&x.actorUserId===users.get('ADMIN')&&x.actorPersonId===users.get('ADMIN')&&x.personId===users.get('ADMIN'))).toBe(true)
    const metadata=JSON.stringify(events.map(x=>x.metadata));expect(metadata).not.toContain('Subject Alpha');expect(metadata).not.toContain('alpha@test.invalid');expect(metadata).not.toContain('11900000001')
    expect(events.some(x=>(x.metadata as any).scope==='customer'&&(x.metadata as any).recordCount===1)).toBe(true)
    expect(await db.auditEvent.count({where:{orgId:orgB}})).toBe(0)
  })
  it('does not release a prepared CSV if its required audit write fails',async()=>{
    const spy=jest.spyOn(app.get(AuditService),'log').mockRejectedValue(new Error('synthetic audit outage'))
    try{
      await expect(app.get(CustomersService).exportCsv(orgA,customers[0],users.get('ADMIN'))).rejects.toThrow('synthetic audit outage')
      await expect(app.get(FinanceService).exportChargesCsv(orgA,customers[0],users.get('ADMIN'))).rejects.toThrow('synthetic audit outage')
      for(const path of paths){const res=await request(app.getHttpServer()).get(path+'?customerId='+customers[0]).set(auth()).expect(500);expect(res.text).not.toContain('Subject Alpha');expect(res.headers['content-type']).not.toContain('text/csv')}
    }finally{spy.mockRestore()}
  })
})
