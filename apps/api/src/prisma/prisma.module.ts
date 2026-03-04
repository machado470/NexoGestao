import { Global, Module } from '@nestjs/common'
import { ClsModule } from 'nestjs-cls'
import { PrismaService } from './prisma.service'

@Global()
@Module({
  imports: [ClsModule.forFeature()],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
