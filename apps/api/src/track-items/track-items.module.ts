import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TrackItemsService } from './track-items.service'
import { TrackItemsController } from './track-items.controller'

@Module({
  imports: [PrismaModule],
  providers: [TrackItemsService],
  controllers: [TrackItemsController],
  exports: [TrackItemsService],
})
export class TrackItemsModule {}
