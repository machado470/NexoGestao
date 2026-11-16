import { validate } from 'class-validator'
import { UpdateOrganizationSettingsDto } from './update-organization-settings.dto'

describe('UpdateOrganizationSettingsDto', () => {
  it('aceita somente o contrato canônico de configurações', async () => {
    const payload = Object.assign(new UpdateOrganizationSettingsDto(), { name: 'Nexo Oficina', timezone: 'UTC', currency: 'BRL' })

    await expect(validate(payload, { whitelist: true, forbidNonWhitelisted: true })).resolves.toEqual([])
  })

  it('rejeita organizationName legado para não mascarar persistência inexistente', async () => {
    const payload = Object.assign(new UpdateOrganizationSettingsDto(), { organizationName: 'Contrato Antigo' })

    const errors = await validate(payload, { whitelist: true, forbidNonWhitelisted: true })

    expect(errors).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'organizationName' })]))
  })
})

// Match the production ValidationPipe transformation before validating.
describe('organization settings input boundaries', () => {
  const transform = async (input: Record<string, unknown>) => {
    const { plainToInstance } = await import('class-transformer')
    return plainToInstance(UpdateOrganizationSettingsDto, input)
  }

  it.each(['UTC', 'America/Sao_Paulo', 'Europe/Lisbon', 'Asia/Kolkata'])(
    'accepts the timezone %s', async timezone => {
      expect(await validate(await transform({ timezone }))).toEqual([])
    },
  )

  it.each([
    { name: '   ' }, { name: null }, { name: 123 },
    { timezone: '' }, { timezone: '   ' }, { timezone: 'Mars/Olympus' },
    { timezone: '+03:00' }, { timezone: null }, { timezone: 123 },
    { currency: null }, { currency: 'GBP' },
  ])('rejects invalid configuration %j', async input => {
    expect((await validate(await transform(input))).length).toBeGreaterThan(0)
  })

  it('trims text while preserving a partial update', async () => {
    const dto = await transform({ name: '  Oficina  ', timezone: ' UTC ' })
    expect(await validate(dto)).toEqual([])
    expect(dto).toMatchObject({ name: 'Oficina', timezone: 'UTC' })
    expect(dto.currency).toBeUndefined()
    expect(await validate(await transform({}))).toEqual([])
  })
})
