import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';
import { PrismaService } from '../prisma/prisma.service';
import { EmailModule } from '../email/email.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [EmailModule, ConfigModule, AuthModule],
  providers: [InvitesService, PrismaService],
  controllers: [InvitesController],
  exports: [InvitesService],
})
export class InvitesModule {}
