import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateReferralDto, ReferralStatus } from './dto/create-referral.dto'

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, query: { page?: number; limit?: number; status?: ReferralStatus; q?: string }) {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 100)
    const skip = (page - 1) * limit

    const where: any = { orgId }
    if (query.status) where.status = query.status
    if (query.q) {
      where.OR = [
        { referrerName: { contains: query.q, mode: 'insensitive' } },
        { referredName: { contains: query.q, mode: 'insensitive' } },
        { referrerEmail: { contains: query.q, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.referral.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.referral.count({ where }),
    ])

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }
  }

  async summary(orgId: string) {
    const [byStatus, totalCredits] = await Promise.all([
      this.prisma.referral.groupBy({
        by: ['status'],
        where: { orgId },
        _count: { id: true },
        _sum: { creditAmountCents: true },
      }),
      this.prisma.referral.aggregate({
        where: { orgId, status: 'PAID' },
        _sum: { creditAmountCents: true },
      }),
    ])

    const statusMap: Record<string, { count: number; credits: number }> = {}
    for (const item of byStatus) {
      statusMap[item.status] = {
        count: item._count.id,
        credits: item._sum.creditAmountCents ?? 0,
      }
    }

    return {
      byStatus: statusMap,
      totalCreditsPaid: totalCredits._sum.creditAmountCents ?? 0,
    }
  }

  async stats(orgId: string, query: { page?: number; limit?: number }) {
    return this.list(orgId, query)
  }

  async getBalance(orgId: string) {
    const pending = await this.prisma.referral.aggregate({
      where: { orgId, status: 'CONFIRMED' },
      _sum: { creditAmountCents: true },
    })
    const paid = await this.prisma.referral.aggregate({
      where: { orgId, status: 'PAID' },
      _sum: { creditAmountCents: true },
    })
    return {
      pendingBalance: pending._sum.creditAmountCents ?? 0,
      paidBalance: paid._sum.creditAmountCents ?? 0,
    }
  }

  async create(orgId: string, dto: CreateReferralDto) {
    // ✅ Verifica duplicidade: mesmo referrer e referred na mesma org
    const existing = await this.prisma.referral.findFirst({
      where: {
        orgId,
        referrerEmail: dto.referrerEmail,
        referredEmail: dto.referredEmail,
      },
    })
    if (existing) {
      throw new ConflictException(
        `Já existe uma indicação de ${dto.referrerEmail} para ${dto.referredEmail}`,
      )
    }

    // ✅ Gera código único com retry (até 5 tentativas)
    let code = generateCode()
    let attempts = 0
    while (attempts < 5) {
      const codeExists = await this.prisma.referral.findFirst({ where: { code } })
      if (!codeExists) break
      code = generateCode()
      attempts++
    }

    return this.prisma.referral.create({
      data: {
        orgId,
        referrerName: dto.referrerName,
        referrerEmail: dto.referrerEmail,
        referrerPhone: dto.referrerPhone,
        referredName: dto.referredName,
        referredEmail: dto.referredEmail,
        referredPhone: dto.referredPhone,
        creditAmountCents: dto.creditAmount ? Math.round(dto.creditAmount * 100) : 0,
        status: dto.status ?? 'PENDING',
        code,
      },
    })
  }

  async update(orgId: string, id: string, dto: { status?: ReferralStatus; creditAmount?: number }) {
    const referral = await this.prisma.referral.findFirst({ where: { id, orgId } })
    if (!referral) throw new NotFoundException('Indicação não encontrada')

    const updateData: any = {}
    if (dto.status) {
      updateData.status = dto.status
      if (dto.status === 'CONFIRMED' && !referral.confirmedAt) {
        updateData.confirmedAt = new Date()
      }
      if (dto.status === 'PAID' && !referral.paidAt) {
        updateData.paidAt = new Date()
      }
    }
    if (dto.creditAmount !== undefined) {
      updateData.creditAmountCents = Math.round(dto.creditAmount * 100)
    }

    return this.prisma.referral.update({ where: { id }, data: updateData })
  }

  async delete(orgId: string, id: string) {
    const referral = await this.prisma.referral.findFirst({ where: { id, orgId } })
    if (!referral) throw new NotFoundException('Indicação não encontrada')
    await this.prisma.referral.delete({ where: { id } })
    return { ok: true }
  }

  async generateCode(orgId: string) {
    const code = generateCode()
    const baseUrl = process.env.APP_URL ?? process.env.FRONTEND_URL ?? 'https://app.nexogestao.com.br'
    const referralUrl = `${baseUrl}/register?ref=${code}`
    return { code, referralUrl }
  }
}
