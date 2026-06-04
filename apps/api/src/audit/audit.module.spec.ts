import { GUARDS_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { AuditAdminController } from './audit-admin.controller'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
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

  it('mantém endpoints admin registrados e protegidos por guards', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AuditAdminController)).toBe('audit')
    expect(Reflect.getMetadata(PATH_METADATA, AuditAdminController.prototype.listEvents)).toBe('events')
    expect(Reflect.getMetadata(PATH_METADATA, AuditAdminController.prototype.getSummary)).toBe('summary')
    expect(Reflect.getMetadata(GUARDS_METADATA, AuditAdminController)).toEqual([JwtAuthGuard, RolesGuard])
  })
})
