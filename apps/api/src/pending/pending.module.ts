import { Module } from '@nestjs/common'
import { PendingService } from './pending.service'
import { PendingController } from './pending.controller'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [PendingController],
  providers: [PendingService],
  exports: [PendingService], // 🔥 ESSENCIAL
})
export class PendingModule {}
