import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { OrganizationMembersController } from './organization-members.controller'
import { OrganizationMembersService } from './organization-members.service'

@Module({ imports: [PrismaModule], controllers: [OrganizationMembersController], providers: [OrganizationMembersService] })
export class OrganizationMembersModule {}
