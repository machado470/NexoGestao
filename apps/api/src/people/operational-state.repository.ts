import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { OperationalState } from './operational-state.service'

@Injectable()
export class OperationalStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getLastState(personId: string): Promise<OperationalState | null> {
    const last = await this.prisma.auditEvent.findFirst({
      where: {
        personId,
        action: 'OPERATIONAL_STATE_CHANGED',
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!last || !last.metadata || typeof last.metadata !== 'object') {
      return null
    }

    const state = (last.metadata as any).state

    if (state === 'NORMAL' || state === 'RESTRICTED' || state === 'SUSPENDED') {
      return state
    }

    return null
  }
}
