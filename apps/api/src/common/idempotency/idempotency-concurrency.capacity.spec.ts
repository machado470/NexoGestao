import { firstValueFrom, of, Subject, throwError } from 'rxjs'
import { IdempotencyCacheService } from './idempotency-cache.service'
import { IdempotencyInterceptor } from './idempotency.interceptor'

function context(orgId='org-a',body:any={content:'QA'},alias=false):any {
  const req={method:'POST',originalUrl:'/whatsapp/messages',headers:{[alias?'idempotency-key':'x-idempotency-key']:'same-key'},user:{orgId},body}
  const res={statusCode:201,status:jest.fn()}
  return {switchToHttp:()=>({getRequest:()=>req,getResponse:()=>res})}
}
describe('HTTP idempotency concurrency and tenant boundaries',()=>{
  it('replays a completed request after lock release and accepts both header aliases',async()=>{
    const interceptor=new IdempotencyInterceptor(new IdempotencyCacheService())
    const next={handle:jest.fn(()=>of({id:'single'}))}
    expect(await firstValueFrom(interceptor.intercept(context(),next))).toEqual({id:'single'})
    expect(await firstValueFrom(interceptor.intercept(context('org-a',{content:'QA'},true),next))).toEqual({id:'single'})
    expect(next.handle).toHaveBeenCalledTimes(1)
  })
  it('does not execute concurrent duplicates while the first response is pending',async()=>{
    const interceptor=new IdempotencyInterceptor(new IdempotencyCacheService()), pending=new Subject<any>()
    const next={handle:jest.fn(()=>pending)}
    const first=firstValueFrom(interceptor.intercept(context(),next))
    await new Promise(resolve=>setImmediate(resolve))
    await expect(firstValueFrom(interceptor.intercept(context(),next))).rejects.toMatchObject({status:409})
    expect(next.handle).toHaveBeenCalledTimes(1)
    pending.next({id:'single'});pending.complete();await first
    expect(await firstValueFrom(interceptor.intercept(context(),next))).toEqual({id:'single'})
    expect(next.handle).toHaveBeenCalledTimes(1)
  })
  it('isolates the same key and URI by authenticated organization',async()=>{
    const interceptor=new IdempotencyInterceptor(new IdempotencyCacheService())
    await firstValueFrom(interceptor.intercept(context('org-a'),{handle:()=>of({org:'a'})}))
    expect(await firstValueFrom(interceptor.intercept(context('org-b'),{handle:()=>of({org:'b'})}))).toEqual({org:'b'})
  })
  it('rejects conflicting content and treats reordered fields as the same payload',async()=>{
    const interceptor=new IdempotencyInterceptor(new IdempotencyCacheService())
    await firstValueFrom(interceptor.intercept(context('org-a',{content:'QA',messageType:'MANUAL'}),{handle:()=>of({id:'single'})}))
    const next={handle:jest.fn()}
    await expect(firstValueFrom(interceptor.intercept(context('org-a',{content:'DIFFERENT'}),next))).rejects.toMatchObject({status:409})
    expect(await firstValueFrom(interceptor.intercept(context('org-a',{messageType:'MANUAL',content:'QA'}),next))).toEqual({id:'single'})
    expect(next.handle).not.toHaveBeenCalled()
  })
  it('releases failed requests for a later retry without caching the failure',async()=>{
    const interceptor=new IdempotencyInterceptor(new IdempotencyCacheService())
    await expect(firstValueFrom(interceptor.intercept(context(),{handle:()=>throwError(()=>new Error('temporary'))}))).rejects.toThrow('temporary')
    expect(await firstValueFrom(interceptor.intercept(context(),{handle:()=>of({retry:true})}))).toEqual({retry:true})
  })
})
