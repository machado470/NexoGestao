import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateLaunchDto, LaunchType } from './dto/create-launch.dto'

@Injectable()
export class LaunchesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, query: { page?: number; limit?: number; type?: LaunchType; from?: string; to?: string }) {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 100)
    const skip = (page - 1) * limit

    const where: any = { orgId }
    if (query.type) where.type = query.type
    if (query.from || query.to) {
      where.date = {}
      if (query.from) where.date.gte = new Date(query.from)
      if (query.to) where.date.lte = new Date(query.to)
    }

    const [data, total] = await Promise.all([
      this.prisma.launch.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.launch.count({ where }),
    ])

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }
  }

  async summary(orgId: string) {
    const [byType] = await Promise.all([
      this.prisma.launch.groupBy({
        by: ['type'],
        where: { orgId },
        _sum: { amountCents: true },
        _count: { id: true },
      }),
    ])

    let income = 0
    let expense = 0
    let transfer = 0

    for (const item of byType) {
      if (item.type === 'INCOME') income = item._sum.amountCents ?? 0
      if (item.type === 'EXPENSE') expense = item._sum.amountCents ?? 0
      if (item.type === 'TRANSFER') transfer = item._sum.amountCents ?? 0
    }

    return {
      income,
      expense,
      transfer,
      balance: income - expense,
    }
  }

  async create(orgId: string, userId: string | null, dto: CreateLaunchDto) {
    return this.prisma.launch.create({
      data: {
        orgId,
        description: dto.description,
        amountCents: dto.amountCents,
        type: dto.type,
        category: dto.category,
        account: dto.account,
        date: new Date(dto.date),
        notes: dto.notes,
        createdByUserId: userId,
      },
    })
  }

  async update(orgId: string, id: string, dto: Partial<CreateLaunchDto>) {
    const launch = await this.prisma.launch.findFirst({ where: { id, orgId } })
    if (!launch) throw new NotFoundException('Lançamento não encontrado')

    return this.prisma.launch.update({
      where: { id },
      data: {
        description: dto.description,
        amountCents: dto.amountCents,
        type: dto.type,
        category: dto.category,
        account: dto.account,
        date: dto.date ? new Date(dto.date) : undefined,
        notes: dto.notes,
      },
    })
  }

  async delete(orgId: string, id: string) {
    const launch = await this.prisma.launch.findFirst({ where: { id, orgId } })
    if (!launch) throw new NotFoundException('Lançamento não encontrado')
    await this.prisma.launch.delete({ where: { id } })
    return { ok: true }
  }
}
