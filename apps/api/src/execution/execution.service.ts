import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { FinanceService } from '../finance/finance.service'

@Injectable()
export class ExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
    private readonly finance: FinanceService,
  ) {}

  async listByServiceOrder(orgId: string, serviceOrderId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT * FROM "Execution" WHERE "orgId"=$1 AND "serviceOrderId"=$2 ORDER BY "createdAt" DESC`,
      orgId,
      serviceOrderId,
    )
  }

  async start(input: { orgId: string; serviceOrderId: string; executorPersonId?: string | null; notes?: string; checklist?: any; attachments?: any }) {
    const so = await this.prisma.serviceOrder.findFirst({ where: { id: input.serviceOrderId, orgId: input.orgId }, select: { id: true, customerId: true } })
    if (!so) throw new NotFoundException('ServiceOrder não encontrada')
    const rows = (await this.prisma.$queryRawUnsafe(`INSERT INTO "Execution" ("id","orgId","serviceOrderId","customerId","executorPersonId","startedAt","notes","checklist","attachments","createdAt","updatedAt") VALUES (gen_random_uuid(),$1,$2,$3,$4,NOW(),$5,$6::jsonb,$7::jsonb,NOW(),NOW()) RETURNING *`, input.orgId, input.serviceOrderId, so.customerId, input.executorPersonId ?? null, input.notes ?? null, JSON.stringify(input.checklist ?? []), JSON.stringify(input.attachments ?? []))) as any[]
    const created = rows[0]
    await this.timeline.log({ orgId: input.orgId, personId: input.executorPersonId ?? null, action: 'EXECUTION_STARTED', metadata: { executionId: created.id, serviceOrderId: input.serviceOrderId, customerId: so.customerId } })
    await this.prisma.serviceOrder.updateMany({ where: { id: input.serviceOrderId, orgId: input.orgId }, data: { status: 'IN_PROGRESS', executionStartedAt: new Date() } })
    return created
  }

  async complete(input: { orgId: string; executionId: string; notes?: string; checklist?: any; attachments?: any }) {
    const existing = (await this.prisma.$queryRawUnsafe(`SELECT * FROM "Execution" WHERE "id"=$1 AND "orgId"=$2 LIMIT 1`, input.executionId, input.orgId)) as any[]
    if (!existing[0]) throw new NotFoundException('Execution não encontrada')
    if (existing[0].endedAt) throw new BadRequestException('Execution já concluída')
    const rows = (await this.prisma.$queryRawUnsafe(`UPDATE "Execution" SET "endedAt"=NOW(), "notes"=COALESCE($1,"notes"), "checklist"=COALESCE($2::jsonb,"checklist"), "attachments"=COALESCE($3::jsonb,"attachments"), "updatedAt"=NOW() WHERE "id"=$4 AND "orgId"=$5 RETURNING *`, input.notes ?? null, input.checklist ? JSON.stringify(input.checklist) : null, input.attachments ? JSON.stringify(input.attachments) : null, input.executionId, input.orgId)) as any[]
    const updated = rows[0]
    await this.prisma.serviceOrder.updateMany({ where: { id: updated.serviceOrderId, orgId: input.orgId }, data: { status: 'DONE', executionEndedAt: new Date() } })

    const serviceOrder = await this.prisma.serviceOrder.findFirst({
      where: { id: updated.serviceOrderId, orgId: input.orgId },
      select: { amountCents: true, dueDate: true },
    })

    if (serviceOrder && serviceOrder.amountCents > 0) {
      await this.finance.ensureChargeForServiceOrderDone({
        orgId: input.orgId,
        serviceOrderId: updated.serviceOrderId,
        customerId: updated.customerId,
        amountCents: serviceOrder.amountCents,
        dueDate: serviceOrder.dueDate,
      })
    }

    await this.timeline.log({ orgId: input.orgId, action: 'EXECUTION_DONE', metadata: { executionId: updated.id, serviceOrderId: updated.serviceOrderId, customerId: updated.customerId } })
    return updated
  }
}
