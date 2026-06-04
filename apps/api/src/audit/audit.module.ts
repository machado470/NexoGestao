import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { AuditAdminController } from './audit-admin.controller'
import { AuditAdminService } from './audit-admin.service'
import { AuditService } from './audit.service'

@Module({
  imports: [PrismaModule],
  controllers: [AuditAdminController],
  providers: [AuditService, AuditAdminService],
  exports: [AuditService]
})
export class AuditModule {}
