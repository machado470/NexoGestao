import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateInvoiceDto, InvoiceStatus } from './dto/create-invoice.dto'

// ✅ Mapa de transições de status válidas para Faturas
// DRAFT → ISSUED → PAID
// DRAFT → CANCELLED
// ISSUED → CANCELLED
const VALID_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.ISSUED, InvoiceStatus.CANCELLED],
  [InvoiceStatus.ISSUED]: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.CANCELLED]: [],
}

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
      // Aliases convenientes para o frontend
      totalIssued: statusMap['ISSUED']?.total ?? 0,
      totalPaid: statusMap['PAID']?.total ?? 0,
      pending: statusMap['DRAFT']?.count ?? 0,
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

    // ✅ Validação: valor deve ser positivo
    if (dto.amountCents <= 0) {
      throw new BadRequestException('O valor da fatura deve ser maior que zero')
    }

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

    // ✅ Validação de transição de status
    if (dto.status && dto.status !== invoice.status) {
      const currentStatus = invoice.status as InvoiceStatus
      const allowedTransitions = VALID_TRANSITIONS[currentStatus] ?? []
      if (!allowedTransitions.includes(dto.status as InvoiceStatus)) {
        throw new BadRequestException(
          `Transição de status inválida: ${invoice.status} → ${dto.status}. ` +
          `Transições permitidas: ${allowedTransitions.join(', ') || 'nenhuma'}`,
        )
      }
    }

    // ✅ Validação: valor deve ser positivo se fornecido
    if (dto.amountCents !== undefined && dto.amountCents <= 0) {
      throw new BadRequestException('O valor da fatura deve ser maior que zero')
    }

    // ✅ Atualizar timestamps de acordo com o status
    const updateData: any = {
      customerId: dto.customerId,
      number: dto.number,
      description: dto.description,
      amountCents: dto.amountCents,
      status: dto.status,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      notes: dto.notes,
    }

    if (dto.status === InvoiceStatus.ISSUED && !invoice.issuedAt) {
      updateData.issuedAt = dto.issuedAt ? new Date(dto.issuedAt) : new Date()
    }
    if (dto.status === InvoiceStatus.PAID && !invoice.paidAt) {
      updateData.paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date()
    }

    return this.prisma.invoice.update({
      where: { id },
      data: updateData,
    })
  }

  async delete(orgId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, orgId } })
    if (!invoice) throw new NotFoundException('Fatura não encontrada')

    // ✅ Impede exclusão de faturas pagas
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Não é possível excluir uma fatura já paga')
    }

    await this.prisma.invoice.delete({ where: { id } })
    return { ok: true }
  }
}
