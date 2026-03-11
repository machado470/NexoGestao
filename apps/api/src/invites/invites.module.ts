import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { PrismaModule } from '../prisma/prisma.module'
import { EmailModule } from '../email/email.module'
import { AuthModule } from '../auth/auth.module'

import { InvitesService } from './invites.service'
import { InvitesController } from './invites.controller'

@Module({
  imports: [PrismaModule, EmailModule, ConfigModule, AuthModule],
  providers: [InvitesService],
  controllers: [InvitesController],
  exports: [InvitesService],
})
export class InvitesModule {}
