import { commercialUsagePeriod, CommercialPolicyService } from './commercial-policy.service'
import { TenantOperationsService } from '../tenant-ops/tenant-ops.service'

describe('Commercial meter sources and periods',()=>{
  it.each([
    ['2026-12-31T23:59:59.999Z','2026-12-01T00:00:00.000Z','2027-01-01T00:00:00.000Z'],
    ['2028-02-29T23:59:59.999Z','2028-02-01T00:00:00.000Z','2028-03-01T00:00:00.000Z'],
    ['2026-11-01T00:00:00Z','2026-11-01T00:00:00.000Z','2026-12-01T00:00:00.000Z'],
  ])('uses calendar month boundaries for %s',(date,start,end)=>{
    const period=commercialUsagePeriod(new Date(date));expect(period.start.toISOString()).toBe(start);expect(period.end.toISOString()).toBe(end);expect(period.timezone).toBe('UTC')
  })
  it('reads configured rule count rather than executions and rejects invalid limit overrides',async()=>{
    const db:any={subscription:{findUnique:jest.fn().mockResolvedValue({status:'ACTIVE',plan:{name:'FREE',limitsJson:{configurable_automations:NaN,message_sends:-1,automation_executions:1.5,finance_critical_actions:Infinity}}})},tenantFeatureOverride:{findMany:jest.fn().mockResolvedValue([])},automationRule:{count:jest.fn().mockResolvedValue(3)}}
    const ops=new TenantOperationsService();ops.increment('org','automation_execution',999999)
    const policy=new CommercialPolicyService(db,ops),context=await policy.getContext('org')
    expect(context.limits).toEqual({configurable_automations:3,message_sends:300,automation_executions:200,finance_critical_actions:100})
    expect(await policy.enforceMeter('org','configurable_automations')).toMatchObject({allowed:false,used:3,limit:3,reasonCode:'plan_limit_reached'})
    expect(db.automationRule.count).toHaveBeenCalledWith({where:{orgId:'org'}})
  })
})
