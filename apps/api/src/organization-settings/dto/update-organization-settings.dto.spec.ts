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
