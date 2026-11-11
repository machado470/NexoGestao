import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { TenantOperationsService } from '../../src/common/tenant-ops/tenant-ops.service'

const suite = process.env.RUN_REAL_INTEGRATION === 'true' ? describe : describe.skip
suite('Shared tenant limits / PostgreSQL', () => {
  const db = new PrismaClient()
  const orgId = randomUUID()
  const input = { orgId, scope:'concurrent', limit:10, windowMs:60000, blockedReason:'limited' }
  beforeAll(() => db.$connect())
  afterAll(async () => { await db.tenantRateLimitBucket.deleteMany({where:{orgId}}); await db.$disconnect() })
  it('shares an atomic budget across concurrent API instances and restarts', async () => {
    const instances = [new TenantOperationsService(db as any), new TenantOperationsService(db as any)]
    const results = await Promise.all(Array.from({length:30},(_,i)=>instances[i%2].enforceLimit(input)))
    expect(results.filter(x=>x.allowed)).toHaveLength(10)
    expect((await new TenantOperationsService(db as any).enforceLimit(input)).allowed).toBe(false)
    expect((await instances[0].enforceLimit({...input,scope:'another-scope'})).allowed).toBe(true)
  })
  it('rolls back a budget consumed inside the execution transaction', async () => {
    const service = new TenantOperationsService(db as any)
    const params={...input,scope:'rollback',limit:1}
    await expect(db.$transaction(async tx=>{
      expect((await service.enforceLimit(params,tx as any)).allowed).toBe(true)
      throw new Error('rollback fixture')
    })).rejects.toThrow('rollback fixture')
    expect((await service.enforceLimit(params)).allowed).toBe(true)
    expect((await service.enforceLimit(params)).allowed).toBe(false)
  })
  it('never decreases a shared counter when replicas have different configured limits', async () => {
    const service = new TenantOperationsService(db as any)
    await db.tenantRateLimitBucket.create({data:{orgId,scope:'mixed-limits',count:99}})
    expect((await service.enforceLimit({...input,scope:'mixed-limits',limit:60})).allowed).toBe(false)
    expect((await db.tenantRateLimitBucket.findUniqueOrThrow({where:{orgId_scope:{orgId,scope:'mixed-limits'}}})).count).toBe(99)
    expect((await service.enforceLimit({...input,scope:'mixed-limits',limit:100})).allowed).toBe(true)
    expect((await service.enforceLimit({...input,scope:'mixed-limits',limit:100})).allowed).toBe(false)
  })
  it('opens a new window according to the database clock', async () => {
    const service = new TenantOperationsService(db as any)
    await db.tenantRateLimitBucket.create({data:{orgId,scope:'expired',startedAt:new Date('2000-01-01'),count:100}})
    expect((await service.enforceLimit({...input,scope:'expired',limit:1})).allowed).toBe(true)
    expect((await service.enforceLimit({...input,scope:'expired',limit:1})).allowed).toBe(false)
  })
})
