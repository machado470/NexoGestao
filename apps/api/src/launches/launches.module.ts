import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { LaunchesController } from './launches.controller'
import { LaunchesService } from './launches.service'

@Module({
  imports: [PrismaModule],
  controllers: [LaunchesController],
  providers: [LaunchesService],
  exports: [LaunchesService],
})
export class LaunchesModule {}
