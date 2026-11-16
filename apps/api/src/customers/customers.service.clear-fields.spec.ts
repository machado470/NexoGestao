import { CustomersService } from './customers.service'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { UpdateCustomerDto } from './dto/update-customer.dto'

const before = { id: 'customer-1', name: 'Cliente', phone: '5511999999999', email: 'old@example.com', notes: 'Nota anterior', active: true, updatedAt: new Date('2026-11-08T12:00:00Z') }

describe('clearing optional customer fields', () => {
  it.each([
    [{ email: null }, { email: null }],
    [{ notes: null }, { notes: null }],
    [{ email: null, notes: null }, { email: null, notes: null }],
    [{ name: 'Nome atualizado' }, { name: 'Nome atualizado' }],
  ])('persists only the explicit patch %j', async (patch, expected) => {
    const prisma: any = { customer: {
      findFirst: jest.fn().mockResolvedValueOnce(before).mockResolvedValueOnce({ ...before, ...expected }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    } }
    const timeline = { log: jest.fn() }, audit = { log: jest.fn() }
    const service = new CustomersService(prisma, timeline as any, audit as any, {} as any, {} as any, {} as any, {} as any)
    const result = await service.update({ orgId: 'org-1', updatedBy: 'admin', personId: null, id: before.id, data: { ...patch, expectedUpdatedAt: before.updatedAt.toISOString() } })
    expect(prisma.customer.updateMany).toHaveBeenCalledWith({
      where: { id: before.id, orgId: 'org-1', updatedAt: before.updatedAt }, data: expected,
    })
    expect(result).toMatchObject({ ...before, ...expected })
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ patch: expected }) }))
  })

  it('accepts explicit null for optional fields at the API boundary', async () => {
    const dto = plainToInstance(UpdateCustomerDto, { email: null, notes: null }, { enableImplicitConversion: true })
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([])
    expect(dto.email).toBeNull()
    expect(dto.notes).toBeNull()
  })

  it('still rejects a nonempty malformed email', async () => {
    expect((await validate(plainToInstance(UpdateCustomerDto, { email: 'invalid' }))).length).toBeGreaterThan(0)
  })
})
