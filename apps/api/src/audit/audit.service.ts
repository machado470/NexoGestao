import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    personId?: string
    action: string
    context?: string
  }) {
    return this.prisma.auditEvent.create({
      data: {
        personId: params.personId,
        action: params.action,
        context: params.context,
      },
    })
  }

  async listLatest(limit = 50) {
    return this.prisma.auditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        person: {
          select: { name: true },
        },
      },
    })
  }
}

