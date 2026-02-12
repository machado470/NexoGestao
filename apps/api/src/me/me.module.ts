import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import { AssignmentsModule } from '../assignments/assignments.module'
import { OperationalStateModule } from '../people/operational-state.module'
import { PendingModule } from '../pending/pending.module'

import { MeController } from './me.controller'

@Module({
  imports: [
    PrismaModule,
    AssignmentsModule,
    OperationalStateModule,
    PendingModule, // 🔥 AGORA EXISTE NO CONTEXTO
  ],
  controllers: [MeController],
})
export class MeModule {}
