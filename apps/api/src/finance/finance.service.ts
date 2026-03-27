import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

type FinanceOverview = {
  openCount: number
  openAmountCents: number
  overdueCount: number
  overdueAmountCents: number
  paidCount: number
  paidAmountCents: number
  nextDue: Array<{
    id: string
    customerId: string
    amountCents: number
    status: string
    dueDate: Date
  }>
  recentPayments: Array<{
    id: string
    chargeId: string
    amountCents: number
    method: string
    paidAt: Date
  }>
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(orgId: string): Promise<FinanceOverview> {
    const now = new Date()

    const [openAgg, overdueAgg, paidAgg, nextDue, recentPayments] =
      await Promise.all([
        this.prisma.charge.aggregate({
          where: { orgId, status: 'PENDING' },
          _count: { _all: true },
          _sum: { amountCents: true },
        }),
        this.prisma.charge.aggregate({
          where: { orgId, status: 'PENDING', dueDate: { lt: now } },
          _count: { _all: true },
          _sum: { amountCents: true },
        }),
        this.prisma.payment.aggregate({
          where: { orgId },
          _count: { _all: true },
          _sum: { amountCents: true },
        }),
        this.prisma.charge.findMany({
          where: { orgId, status: 'PENDING' },
          orderBy: { dueDate: 'asc' },
          take: 10,
          select: {
            id: true,
            customerId: true,
            amountCents: true,
            status: true,
            dueDate: true,
          },
        }),
        this.prisma.payment.findMany({
          where: { orgId },
          orderBy: { paidAt: 'desc' },
          take: 10,
          select: {
            id: true,
            chargeId: true,
            amountCents: true,
            method: true,
            paidAt: true,
          },
        }),
      ])

    return {
      openCount: openAgg._count._all ?? 0,
      openAmountCents: openAgg._sum.amountCents ?? 0,
      overdueCount: overdueAgg._count._all ?? 0,
      overdueAmountCents: overdueAgg._sum.amountCents ?? 0,
      paidCount: paidAgg._count._all ?? 0,
      paidAmountCents: paidAgg._sum.amountCents ?? 0,
      nextDue,
      recentPayments,
    }
  }
}
