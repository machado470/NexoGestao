import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateInvoiceDto, InvoiceStatus } from './dto/create-invoice.dto'

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, query: { page?: number; limit?: number; status?: InvoiceStatus; customerId?: string; q?: string }) {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 100)
    const skip = (page - 1) * limit

    const where: any = { orgId }
    if (query.status) where.status = query.status
    if (query.customerId) where.customerId = query.customerId
    if (query.q) {
      where.OR = [
        { number: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: { customer: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ])

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }
  }

  async summary(orgId: string) {
    const [byStatus, totalAgg] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: { orgId },
        _sum: { amountCents: true },
        _count: { id: true },
      }),
      this.prisma.invoice.aggregate({
        where: { orgId },
        _sum: { amountCents: true },
        _count: { id: true },
      }),
    ])

    const statusMap: Record<string, { count: number; total: number }> = {}
    for (const item of byStatus) {
      statusMap[item.status] = {
        count: item._count.id,
        total: item._sum.amountCents ?? 0,
      }
    }

    return {
      total: totalAgg._sum.amountCents ?? 0,
      count: totalAgg._count.id,
      byStatus: statusMap,
    }
  }

  async findOne(orgId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, orgId },
      include: { customer: true },
    })
    if (!invoice) throw new NotFoundException('Fatura não encontrada')
    return invoice
  }

  async create(orgId: string, dto: CreateInvoiceDto) {
    const existing = await this.prisma.invoice.findFirst({
      where: { orgId, number: dto.number },
    })
    if (existing) throw new ConflictException(`Fatura com número ${dto.number} já existe`)

    return this.prisma.invoice.create({
      data: {
        orgId,
        customerId: dto.customerId,
        number: dto.number,
        description: dto.description,
        amountCents: dto.amountCents,
        status: dto.status ?? 'DRAFT',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        notes: dto.notes,
      },
    })
  }

  async update(orgId: string, id: string, dto: Partial<CreateInvoiceDto>) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, orgId } })
    if (!invoice) throw new NotFoundException('Fatura não encontrada')

    return this.prisma.invoice.update({
      where: { id },
      data: {
        customerId: dto.customerId,
        number: dto.number,
        description: dto.description,
        amountCents: dto.amountCents,
        status: dto.status,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        notes: dto.notes,
      },
    })
  }

  async delete(orgId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, orgId } })
    if (!invoice) throw new NotFoundException('Fatura não encontrada')
    await this.prisma.invoice.delete({ where: { id } })
    return { ok: true }
  }
}
