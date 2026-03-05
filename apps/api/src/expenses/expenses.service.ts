import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateExpenseDto } from './dto/create-expense.dto'
import { ExpensesQueryDto } from './dto/expenses-query.dto'

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, query: ExpensesQueryDto) {
    const page = Number(query.page ?? 1)
    const limit = Math.min(Number(query.limit ?? 20), 100)
    const skip = (page - 1) * limit

    const where: any = { orgId }

    if (query.category) where.category = query.category
    if (query.from || query.to) {
      where.date = {}
      if (query.from) where.date.gte = new Date(query.from)
      if (query.to) where.date.lte = new Date(query.to)
    }

    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ])

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  async summary(orgId: string) {
    const [totalAgg, byCategory] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { orgId },
        _sum: { amountCents: true },
        _count: { id: true },
      }),
      this.prisma.expense.groupBy({
        by: ['category'],
        where: { orgId },
        _sum: { amountCents: true },
      }),
    ])

    const byCategoryMap: Record<string, number> = {}
    for (const item of byCategory) {
      byCategoryMap[item.category] = item._sum.amountCents ?? 0
    }

    return {
      totalExpenses: totalAgg._sum.amountCents ?? 0,
      count: totalAgg._count.id,
      byCategory: byCategoryMap,
    }
  }

  async create(orgId: string, userId: string | null, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        orgId,
        description: dto.description,
        amountCents: dto.amountCents,
        category: dto.category ?? 'OTHER',
        date: new Date(dto.date),
        notes: dto.notes,
        createdByUserId: userId,
      },
    })
  }

  async update(orgId: string, id: string, dto: Partial<CreateExpenseDto>) {
    const expense = await this.prisma.expense.findFirst({ where: { id, orgId } })
    if (!expense) throw new NotFoundException('Despesa não encontrada')

    return this.prisma.expense.update({
      where: { id },
      data: {
        description: dto.description,
        amountCents: dto.amountCents,
        category: dto.category,
        date: dto.date ? new Date(dto.date) : undefined,
        notes: dto.notes,
      },
    })
  }

  async delete(orgId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, orgId } })
    if (!expense) throw new NotFoundException('Despesa não encontrada')
    await this.prisma.expense.delete({ where: { id } })
    return { ok: true }
  }
}
