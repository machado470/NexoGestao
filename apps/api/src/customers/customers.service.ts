import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { AuditService } from '../audit/audit.service'
import { AUDIT_ACTIONS } from '../audit/audit.actions'

function normalizeEmail(v?: string): string | null {
  const s = (v ?? '').trim().toLowerCase()
  return s ? s : null
}

function normalizePhone(v?: string): string {
  // mantém só dígitos (WhatsApp/telefone)
  const digits = (v ?? '').replace(/\D/g, '').trim()
  return digits
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string) {
    return this.prisma.customer.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
  }

  async get(orgId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, orgId },
    })
    if (!customer) throw new NotFoundException('Cliente não encontrado')
    return customer
  }

  async create(params: {
    orgId: string
    createdBy: string | null
    personId: string | null
    name: string
    phone: string
    email?: string
    notes?: string
  }) {
    const name = params.name?.trim()
    const phone = normalizePhone(params.phone)
    const email = normalizeEmail(params.email)
    const notes = (params.notes ?? '').trim() || null

    if (!params.orgId) throw new BadRequestException('orgId é obrigatório')
    if (!name) throw new BadRequestException('Nome é obrigatório')
    if (!phone) throw new BadRequestException('Telefone (WhatsApp) é obrigatório')

    // se veio email, não deixa duplicar por org
    if (email) {
      const exists = await this.prisma.customer.findFirst({
        where: { orgId: params.orgId, email },
        select: { id: true },
      })
      if (exists) {
        throw new BadRequestException('Já existe um cliente com este e-mail')
      }
    }

    const created = await this.prisma.customer.create({
      data: {
        orgId: params.orgId,
        name,
        phone,
        email,
        notes,
        active: true,
      },
    })

    const context = `Cliente criado: ${created.name}`

    await this.timeline.log({
      orgId: params.orgId,
      action: 'CUSTOMER_CREATED',
      description: context,
      personId: params.personId,
      metadata: {
        customerId: created.id,

        // ✅ padrão novo (oficial)
        actorUserId: params.createdBy,
        actorPersonId: params.personId,

        // ✅ compat legado
        createdBy: params.createdBy,
      },
    })

    await this.audit.log({
      orgId: params.orgId,
      action: AUDIT_ACTIONS.CUSTOMER_CREATED,
      actorUserId: params.createdBy,
      actorPersonId: params.personId,
      personId: params.personId,
      entityType: 'CUSTOMER',
      entityId: created.id,
      context,
      metadata: {
        customerId: created.id,
        name: created.name,
        phone: created.phone,
        email: created.email,
        active: created.active,
      },
    })

    return created
  }

  async update(params: {
    orgId: string
    updatedBy: string | null
    personId: string | null
    id: string
    data: {
      name?: string
      phone?: string
      email?: string
      notes?: string
      active?: boolean
    }
  }) {
    if (!params.orgId) throw new BadRequestException('orgId é obrigatório')
    if (!params.id) throw new BadRequestException('id é obrigatório')

    const before = await this.prisma.customer.findFirst({
      where: { id: params.id, orgId: params.orgId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        notes: true,
        active: true,
      },
    })
    if (!before) throw new NotFoundException('Cliente não encontrado')

    const data: any = {}

    if (typeof params.data.name === 'string') {
      const v = params.data.name.trim()
      if (!v) throw new BadRequestException('Nome inválido')
      data.name = v
    }

    if (typeof params.data.phone === 'string') {
      const v = normalizePhone(params.data.phone)
      if (!v) throw new BadRequestException('Telefone inválido')
      data.phone = v
    }

    if (typeof params.data.email === 'string') {
      const v = normalizeEmail(params.data.email)

      if (v && v !== before.email) {
        const dup = await this.prisma.customer.findFirst({
          where: { orgId: params.orgId, email: v, NOT: { id: params.id } },
          select: { id: true },
        })
        if (dup) throw new BadRequestException('Já existe um cliente com este e-mail')
      }

      data.email = v
    }

    if (typeof params.data.notes === 'string') {
      const v = params.data.notes.trim()
      data.notes = v ? v : null
    }

    if (typeof params.data.active === 'boolean') {
      data.active = params.data.active
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nenhum campo para atualizar')
    }

    // 🔒 multi-tenant blindado: where inclui orgId
    const result = await this.prisma.customer.updateMany({
      where: { id: params.id, orgId: params.orgId },
      data,
    })

    if (result.count === 0) {
      throw new NotFoundException('Cliente não encontrado')
    }

    const updated = await this.prisma.customer.findFirst({
      where: { id: params.id, orgId: params.orgId },
    })
    if (!updated) throw new NotFoundException('Cliente não encontrado')

    const context = `Cliente atualizado: ${updated.name}`

    await this.timeline.log({
      orgId: params.orgId,
      action: 'CUSTOMER_UPDATED',
      description: context,
      personId: params.personId,
      metadata: {
        customerId: updated.id,

        // ✅ padrão novo (oficial)
        actorUserId: params.updatedBy,
        actorPersonId: params.personId,

        // ✅ compat legado
        updatedBy: params.updatedBy,

        patch: data,
      },
    })

    const activeChanged =
      data.active !== undefined && data.active !== before.active

    await this.audit.log({
      orgId: params.orgId,
      action: activeChanged
        ? AUDIT_ACTIONS.CUSTOMER_ACTIVE_CHANGED
        : AUDIT_ACTIONS.CUSTOMER_UPDATED,
      actorUserId: params.updatedBy,
      actorPersonId: params.personId,
      personId: params.personId,
      entityType: 'CUSTOMER',
      entityId: updated.id,
      context,
      metadata: {
        customerId: updated.id,
        before,
        after: {
          id: updated.id,
          name: updated.name,
          phone: updated.phone,
          email: updated.email,
          notes: updated.notes,
          active: updated.active,
        },
        patch: data,
      },
    })

    return updated
  }
}
