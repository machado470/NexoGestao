import { ForbiddenException } from '@nestjs/common'
import { RolesGuard } from './roles.guard'

const context = (role?: string) => ({
  getHandler: () => undefined,
  getClass: () => undefined,
  switchToHttp: () => ({ getRequest: () => ({ user: role === undefined ? {} : { role } }) }),
}) as any

describe('RolesGuard canonical role normalization', () => {
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

  it.each(['STAFF', 'OPERADOR', 'VIEWER', 'FINANCEIRO'])('denies %s explicit manager permission', role => {
    expect(() => guardFor(['ADMIN', 'MANAGER']).canActivate(context(role))).toThrow(ForbiddenException)
  })
  it('preserves manager permission', () => {
    expect(guardFor(['ADMIN', 'MANAGER']).canActivate(context('MANAGER'))).toBe(true)
  })
  it('permite rota sem @Roles', () => {
    expect(guardFor([]).canActivate(context())).toBe(true)
  })
})
