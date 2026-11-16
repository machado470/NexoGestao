import { ForbiddenException } from '@nestjs/common'
import { RolesGuard } from './roles.guard'

const context = (role?: string) => ({
  getHandler: () => undefined,
  getClass: () => undefined,
  switchToHttp: () => ({ getRequest: () => ({ user: role === undefined ? {} : { role } }) }),
}) as any

describe('RolesGuard canonical role separation and legacy read aliases', () => {
  const guardFor = (requiredRoles: string[]) => new RolesGuard({ getAllAndOverride: jest.fn().mockReturnValue(requiredRoles) } as any)

  it.each([
    ['MANAGER', ['OPERADOR']],
    ['STAFF', ['OPERADOR']],
    ['VIEWER', ['FINANCEIRO']],
  ])('%s satisfaz %s', (role, requiredRoles) => {
    expect(guardFor(requiredRoles).canActivate(context(role))).toBe(true)
  })

  it.each([
    ['ADMIN', ['OPERADOR']],
    ['ADMIN', ['FINANCEIRO']],
    ['ADMIN', ['OPERADOR', 'FINANCEIRO']],
  ])('ADMIN satisfaz o conjunto %j', (role, requiredRoles) => {
    expect(guardFor(requiredRoles).canActivate(context(role))).toBe(true)
  })

  it.each([undefined, 'UNKNOWN'])('rejeita role ausente ou desconhecida: %s', (role) => {
    expect(() => guardFor(['OPERADOR']).canActivate(context(role))).toThrow(ForbiddenException)
  })

  it.each(['ADMIN', 'MANAGER', 'STAFF', 'VIEWER'])('enforces the declared canonical role for %s without widening it', role => {
    for (const required of ['ADMIN', 'MANAGER', 'STAFF', 'VIEWER']) {
      if (role === 'ADMIN' || role === required) expect(guardFor([required]).canActivate(context(role))).toBe(true)
      else expect(() => guardFor([required]).canActivate(context(role))).toThrow(ForbiddenException)
    }
  })

  it('permite rota sem @Roles', () => {
    expect(guardFor([]).canActivate(context())).toBe(true)
  })
})
