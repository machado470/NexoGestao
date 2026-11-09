import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateInvoiceDto, InvoiceStatus } from './dto/create-invoice.dto'

// Fatura é documento comercial/visual.
// Pagamento real deve acontecer no fluxo financeiro (charge/payment).
const VALID_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.ISSUED, InvoiceStatus.CANCELLED],
  [InvoiceStatus.ISSUED]: [InvoiceStatus.CANCELLED],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.CANCELLED]: [],
}

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCustomer(orgId: string, customerId?: string | null) {
    if (customerId == null) return
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, orgId }, select: { id: true } })
    if (!customer) throw new NotFoundException('Cliente não encontrado nesta organização')
  }

  private assertAmount(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > 2_147_483_647) {
      throw new BadRequestException('Valor deve ser um inteiro entre 1 e 2147483647 centavos')
    }
  }

  private handleWriteError(error: any): never {
    if (error?.code === 'P2002') throw new ConflictException('Número de fatura já existe nesta organização')
    if (error?.code === 'P2003') throw new BadRequestException('Cliente inválido para esta organização')
    throw error
  }

  async list(
    orgId: string,
    query: {
      page?: number
      limit?: number
      status?: InvoiceStatus
      customerId?: string
      q?: string
    },
  ) {
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
        include: {
          customer: {
            where: { orgId },
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ])

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
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
      totalDraft: statusMap['DRAFT']?.total ?? 0,
      totalIssued: statusMap['ISSUED']?.total ?? 0,
      totalPaid: statusMap['PAID']?.total ?? 0,
      pending:
        (statusMap['DRAFT']?.count ?? 0) +
        (statusMap['ISSUED']?.count ?? 0),
    }
  }

  async findOne(orgId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, orgId },
      include: { customer: { where: { orgId } } },
    })

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada')
    }

    return invoice
  }

  async create(orgId: string, dto: CreateInvoiceDto) {
    await this.assertCustomer(orgId, dto.customerId)
    this.assertAmount(dto.amountCents)
    const existing = await this.prisma.invoice.findFirst({
      where: { orgId, number: dto.number },
    })

    if (existing) {
      throw new ConflictException(
        `Fatura com número ${dto.number} já existe`,
      )
    }

    if (dto.amountCents <= 0) {
      throw new BadRequestException(
        'O valor da fatura deve ser maior que zero',
      )
    }

    if (dto.status === InvoiceStatus.PAID) {
      throw new BadRequestException(
        'Fatura não pode ser criada como paga. Use o fluxo financeiro para registrar pagamento.',
      )
    }

    try {
      return await this.prisma.invoice.create({
        data: {
          orgId,
          customerId: dto.customerId,
          number: dto.number,
          description: dto.description ?? '',
          amountCents: dto.amountCents,
          status: dto.status ?? InvoiceStatus.DRAFT,
        },
      })
    } catch (error) {
      this.handleWriteError(error)
    }
  }

  async update(orgId: string, id: string, dto: Partial<CreateInvoiceDto>) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, orgId },
    })

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada')
    }

    if (dto.status === InvoiceStatus.PAID) {
      throw new BadRequestException(
        'Fatura não pode ser marcada como paga diretamente. Use o fluxo financeiro de cobrança/pagamento.',
      )
    }

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

    if (dto.amountCents !== undefined) this.assertAmount(dto.amountCents)
    await this.assertCustomer(orgId, dto.customerId)

    if (dto.number !== undefined && (typeof dto.number !== 'string' || !dto.number.trim())) {
      throw new BadRequestException('Número de fatura inválido')
    }
    const updateData: any = {
      customerId: dto.customerId,
      number: dto.number,
      description: dto.description === undefined ? undefined : dto.description ?? '',
      amountCents: dto.amountCents,
      status: dto.status ?? undefined,
    }

    try {
      return await this.prisma.invoice.update({
        where: { id, orgId },
        data: updateData,
      })
    } catch (error) {
      this.handleWriteError(error)
    }
  }

  async delete(orgId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, orgId },
    })

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada')
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException(
        'Não é possível excluir uma fatura já paga',
      )
    }

    await this.prisma.invoice.delete({
      where: { id },
    })

    return { ok: true }
  }
}
