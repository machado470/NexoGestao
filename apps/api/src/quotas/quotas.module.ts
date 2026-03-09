import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { QuotasService } from './quotas.service'

@Module({
  imports: [PrismaModule],
  providers: [QuotasService],
  exports: [QuotasService]
})
export class QuotasModule {}
