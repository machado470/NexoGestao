import { MODULE_METADATA } from '@nestjs/common/constants'
import { AuditAdminController } from './audit-admin.controller'
import { AuditAdminService } from './audit-admin.service'
import { AuditModule } from './audit.module'

function metadataList(key: string) {
  return Reflect.getMetadata(key, AuditModule) ?? []
}

describe('AuditModule', () => {
  it('registra controller e service administrativos de auditoria', () => {
    expect(metadataList(MODULE_METADATA.CONTROLLERS)).toContain(AuditAdminController)
    expect(metadataList(MODULE_METADATA.PROVIDERS)).toContain(AuditAdminService)
  })
})
