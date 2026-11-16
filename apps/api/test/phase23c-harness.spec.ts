import { execFileSync } from 'node:child_process'
import { assertDedicatedPhase23cInfrastructure, compose } from './integration/phase23c-harness'
jest.mock('node:child_process',()=>({execFileSync:jest.fn()}))
const exec=execFileSync as jest.Mock
const keys=['DATABASE_URL','REDIS_URL','PHASE23C_POSTGRES_PORT','PHASE23C_REDIS_PORT','PHASE23C_COMPOSE_PROJECT'] as const

describe('Recovery infrastructure ownership guard',()=>{
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]))
  beforeEach(()=>{
    exec.mockReset()
    Object.assign(process.env,{PHASE23C_COMPOSE_PROJECT:'nexogestao-phase23c-'+'a'.repeat(32),PHASE23C_POSTGRES_PORT:'41001',PHASE23C_REDIS_PORT:'41002',DATABASE_URL:'postgresql://phase23c:phase23c-local-only@127.0.0.1:41001/phase23c',REDIS_URL:'redis://127.0.0.1:41002/15'})
    exec.mockImplementation((_file,args:string[])=>{
      if(args.includes('ps'))return (args.includes('postgres-phase23c')?'b':'c').repeat(64)+'\n'
      if(args.includes('inspect'))return JSON.stringify(args.at(-1)==='b'.repeat(64)?{'5432/tcp':[{HostIp:'127.0.0.1',HostPort:'41001'}]}:{'6379/tcp':[{HostIp:'127.0.0.1',HostPort:'41002'}]})
      return ''
    })
  })
  afterAll(()=>{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]}})
  it('allows matching dedicated bindings and can start a stopped service',()=>{
    expect(()=>assertDedicatedPhase23cInfrastructure()).not.toThrow();compose('redis-phase23c','start')
    expect(exec).toHaveBeenLastCalledWith('docker',expect.arrayContaining(['-p',process.env.PHASE23C_COMPOSE_PROJECT,'start','redis-phase23c']),expect.any(Object))
    expect(exec.mock.calls.some(([,args])=>args.includes('--all'))).toBe(true)
  })
  it.each([
    ['DATABASE_URL','postgresql://phase23c:x@production:41001/phase23c'],['DATABASE_URL','postgresql://postgres:x@127.0.0.1:41001/phase23c'],['DATABASE_URL','postgresql://phase23c:x@127.0.0.1:41003/phase23c'],['REDIS_URL','redis://127.0.0.1:41002/0'],['PHASE23C_COMPOSE_PROJECT','nexogestao-production'],['PHASE23C_POSTGRES_PORT','0'],
  ])('rejects unsafe %s before Docker calls',(key,value)=>{process.env[key]=value;expect(()=>compose('redis-phase23c','stop')).toThrow('Refusing destructive test');expect(exec).not.toHaveBeenCalled()})
  it('rejects forged environment ports that disagree with the container',()=>{
    process.env.REDIS_URL='redis://127.0.0.1:41003/15';process.env.PHASE23C_REDIS_PORT='41003'
    expect(()=>compose('redis-phase23c','stop')).toThrow('endpoint does not match')
    expect(exec.mock.calls.some(([,args])=>args.includes('stop'))).toBe(false)
  })
  it('rejects a missing dedicated container',()=>{exec.mockReturnValue('');expect(()=>compose('postgres-phase23c','stop')).toThrow('dedicated container not found')})
})
