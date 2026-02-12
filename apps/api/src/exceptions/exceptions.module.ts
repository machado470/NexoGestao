import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { AuditModule } from '../audit/audit.module'
import { ExceptionsController } from './exceptions.controller'
import { ExceptionsService } from './exceptions.service'

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ExceptionsController],
  providers: [ExceptionsService],
})
export class ExceptionsModule {}
