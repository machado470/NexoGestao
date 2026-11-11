import { refundedAmount } from '../common/finance/refunded-amount'
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { ExpenseRecurrence, ExpenseType } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import {
  CreateExpenseDto,
  ExpenseCategory,
  ExpenseRecurrenceDto,
  ExpenseTypeDto,
} from './dto/create-expense.dto'
import { ExpensesQueryDto } from './dto/expenses-query.dto'
import { TimelineService } from '../timeline/timeline.service'
import { zonedMonthBounds } from '../common/zoned-month'

const VALID_CATEGORIES = Object.values(ExpenseCategory)

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
  ) {}

  async list(orgId: string, query: ExpensesQueryDto) {
    const page = Number(query.page ?? 1)
    const limit = Math.min(Number(query.limit ?? 20), 100)
    const skip = (page - 1) * limit

    const where: any = { orgId }

    if (query.category) where.category = query.category
    if (query.type) where.type = query.type
    if (query.recurrence) where.recurrence = query.recurrence

    if (query.from || query.to) {
      where.occurredAt = {}
      if (query.from) where.occurredAt.gte = new Date(query.from)
      if (query.to) where.occurredAt.lte = new Date(query.to)
    }

    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
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

  private async monthlyRange(orgId: string, month?: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId }, select: { timezone: true },
    })
    try {
      return zonedMonthBounds(organization?.timezone as string, month)
    } catch {
      throw new BadRequestException('Mês ou fuso da organização inválido. Use YYYY-MM e um fuso IANA válido.')
    }
  }

  async summary(orgId: string, month?: string) {
    return this.summarizeRange(orgId, await this.monthlyRange(orgId, month))
  }

  private async summarizeRange(orgId: string, range: ReturnType<typeof zonedMonthBounds>) {
    const { start, end } = range

    const monthlyOneOff = {
      orgId,
      recurrence: ExpenseRecurrence.NONE,
      occurredAt: { gte: start, lt: end },
    }
    const recurringActive = {
      orgId,
      recurrence: ExpenseRecurrence.MONTHLY,
      isActive: true,
      occurredAt: { lt: end },
    }

    const [oneOffRows, recurringRows] = await Promise.all([
      this.prisma.expense.findMany({ where: monthlyOneOff }),
      this.prisma.expense.findMany({ where: recurringActive }),
    ])

    const byCategory: Record<string, number> = {}
    let total = 0
    let fixedTotal = 0
    let variableTotal = 0

    for (const row of [...oneOffRows, ...recurringRows]) {
      total += row.amountCents
      byCategory[row.category] = (byCategory[row.category] ?? 0) + row.amountCents
      if (row.type === ExpenseType.FIXED) fixedTotal += row.amountCents
      else variableTotal += row.amountCents
    }


    return {
      month: range.month,
      totalExpenses: total,
      totalFixedExpenses: fixedTotal,
      totalVariableExpenses: variableTotal,
      count: oneOffRows.length + recurringRows.length,
      recurringAppliedCount: recurringRows.length,
      byCategory,
    }
  }

  async getMonthlyFinancialResult(orgId: string, month?: string) {
    const range = await this.monthlyRange(orgId, month)
    const { start, end } = range
    const expenses = await this.summarizeRange(orgId, range)

    const paymentsAgg = await this.prisma.payment.aggregate({
      where: { orgId, paidAt: { gte: start, lt: end } },
      _sum: { amountCents: true },
    })

    const riskAgg = await this.prisma.charge.aggregate({
      where: { orgId, status: 'OVERDUE' },
      _sum: { amountCents: true },
    })

    const openAgg = await this.prisma.charge.aggregate({
      where: { orgId, status: { in: ['PENDING', 'OVERDUE'] } },
      _sum: { amountCents: true },
    })

    const revenue = paymentsAgg._sum.amountCents ?? 0
    const refunded = await refundedAmount(this.prisma, { orgId, paidAt: { gte: start, lt: end } })
    const netRevenue = revenue - refunded
    const net = netRevenue - expenses.totalExpenses
    const committedPercentage = netRevenue > 0 ? (expenses.totalExpenses / netRevenue) * 100 : 0

    return {
      month: expenses.month,
      totalRevenueMonth: revenue,
      refundedAmountMonth: refunded,
      netRevenueMonth: netRevenue,
      totalExpensesMonth: expenses.totalExpenses,
      totalFixedExpensesMonth: expenses.totalFixedExpenses,
      totalVariableExpensesMonth: expenses.totalVariableExpenses,
      netMonthlyResult: net,
      committedPercentage,
      expensesByCategory: expenses.byCategory,
      valueInRisk: riskAgg._sum.amountCents ?? 0,
      valueOpen: openAgg._sum.amountCents ?? 0,
    }
  }

  async create(orgId: string, userId: string | null, dto: CreateExpenseDto) {
    if (!Number.isInteger(dto.amountCents) || dto.amountCents < 1 || dto.amountCents > 2_147_483_647) throw new BadRequestException('O valor da despesa deve ser inteiro entre 1 e 2147483647 centavos')
    if (!VALID_CATEGORIES.includes(dto.category)) throw new BadRequestException(`Categoria inválida: ${dto.category}`)

    const created = await this.prisma.expense.create({
      data: {
        orgId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        amountCents: dto.amountCents,
        category: dto.category,
        type: dto.type,
        recurrence: dto.recurrence ?? ExpenseRecurrenceDto.NONE,
        occurredAt: new Date(dto.occurredAt),
        dueDay: dto.dueDay,
        isActive: dto.isActive ?? true,
        notes: dto.notes,
        createdByUserId: userId,
      },
    })

    await this.timeline.log({
      orgId,
      action: 'EXPENSE_CREATED',
      description: `Despesa criada: ${created.title}`,
      metadata: {
        actorUserId: userId,
        expenseId: created.id,
        category: created.category,
        type: created.type,
        recurrence: created.recurrence,
        amountCents: created.amountCents,
      },
    })

    return created
  }

  async update(orgId: string, id: string, userId: string | null, dto: Partial<CreateExpenseDto>) {
    const expense = await this.prisma.expense.findFirst({ where: { id, orgId } })
    if (!expense) throw new NotFoundException('Despesa não encontrada')

    if (dto.amountCents !== undefined && (!Number.isInteger(dto.amountCents) || dto.amountCents < 1 || dto.amountCents > 2_147_483_647)) {
      throw new BadRequestException('O valor da despesa deve ser inteiro entre 1 e 2147483647 centavos')
    }
    if (dto.category && !VALID_CATEGORIES.includes(dto.category)) {
      throw new BadRequestException(`Categoria inválida: ${dto.category}`)
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        amountCents: dto.amountCents,
        category: dto.category,
        type: dto.type,
        recurrence: dto.recurrence,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        dueDay: dto.dueDay,
        isActive: dto.isActive,
        notes: dto.notes,
      },
    })

    await this.timeline.log({
      orgId,
      action: 'EXPENSE_UPDATED',
      description: `Despesa atualizada: ${updated.title}`,
      metadata: { actorUserId: userId, expenseId: updated.id },
    })

    return updated
  }

  async delete(orgId: string, id: string, userId: string | null) {
    const expense = await this.prisma.expense.findFirst({ where: { id, orgId } })
    if (!expense) throw new NotFoundException('Despesa não encontrada')

    if (expense.recurrence === ExpenseRecurrence.MONTHLY) {
      await this.prisma.expense.update({ where: { id }, data: { isActive: false } })
      await this.timeline.log({
        orgId,
        action: 'EXPENSE_ARCHIVED',
        description: `Despesa recorrente arquivada: ${expense.title}`,
        metadata: { actorUserId: userId, expenseId: id },
      })
      return { ok: true }
    }

    await this.prisma.expense.delete({ where: { id } })
    await this.timeline.log({
      orgId,
      action: 'EXPENSE_ARCHIVED',
      description: `Despesa removida: ${expense.title}`,
      metadata: { actorUserId: userId, expenseId: id },
    })

    return { ok: true }
  }
}
