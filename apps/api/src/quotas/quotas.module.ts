import { Module } from '@nestjs/common'
import { QuotasService } from './quotas.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  providers: [QuotasService],
  exports: [QuotasService],
})
export class QuotasModule {}
