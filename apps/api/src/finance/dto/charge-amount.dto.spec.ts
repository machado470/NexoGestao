import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CreateChargeDto } from './create-charge.dto'
import { UpdateChargeDto } from './update-charge.dto'

describe('Charge integer-cent boundaries', () => {
  const errors = async (amountCents: unknown) => {
    const create = plainToInstance(CreateChargeDto, {
      customerId: '00000000-0000-4000-8000-000000000001', dueDate: '2026-11-09T12:00:00Z', amountCents,
    })
    const update = plainToInstance(UpdateChargeDto, { amountCents })
    return Promise.all([validate(create), validate(update)])
  }
  it.each([1.5, 0, -1, NaN, Infinity, 2_147_483_648])('rejects %p on both write boundaries', async value => {
    for (const result of await errors(value)) expect(result.length).toBeGreaterThan(0)
  })
  it.each([1, 1001, 2_147_483_647])('accepts representable integer cents %p', async value => {
    expect(await errors(value)).toEqual([[], []])
  })
})
