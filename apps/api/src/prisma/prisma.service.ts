import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { ClsService } from 'nestjs-cls'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name)

  constructor(private readonly cls: ClsService) {
    super()
  }

  async onModuleInit() {
    const maxAttempts = 12
    const baseDelayMs = 500

    // Middleware para Multi-tenancy
    this.$use(async (params, next) => {
      const orgId = this.cls.get('orgId')

      // Se não houver orgId no contexto, seguimos normalmente (ex: jobs, seeds, auth)
      if (!orgId) {
        return next(params)
      }

      // Modelos que possuem orgId para isolamento
      const modelsWithOrgId = [
        'User',
        'Person',
        'TimelineEvent',
        'Track',
        'AuditEvent',
        'GovernanceRun',
        'Customer',
        'Appointment',
        'ServiceOrder',
        'Charge',
        'Payment',
        'WhatsAppTemplate',
        'WhatsAppMessage',
        'Expense',
        'Invoice',
        'Launch',
        'Referral',
        'ServiceOrderAttachment',
      ]

      if (params.model && modelsWithOrgId.includes(params.model)) {
        // Operações de leitura: injetar orgId no filtro where
        if (['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(params.action)) {
          params.args.where = { ...params.args.where, orgId }
        }

        // Operações de escrita: garantir orgId nos dados
        if (['create', 'createMany'].includes(params.action)) {
          if (Array.isArray(params.args.data)) {
            params.args.data = params.args.data.map((item: any) => ({ ...item, orgId }))
          } else {
            // Usamos cast para any para evitar erros de tipagem do Prisma que espera org: { connect: { id } }
            // mas o middleware intercepta e aceita a string direta orgId.
            params.args.data = { ...params.args.data, orgId } as any
          }
        }

        // Operações de atualização/deleção: injetar orgId no filtro where para segurança extra
        if (['update', 'updateMany', 'upsert', 'delete', 'deleteMany'].includes(params.action)) {
          params.args.where = { ...params.args.where, orgId }
          
          if (params.action === 'upsert') {
            params.args.create = { ...params.args.create, orgId }
          }
        }
      }

      return next(params)
    })

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.$connect()
        this.logger.log(`Prisma conectado (tentativa ${attempt}/${maxAttempts})`)
        return
      } catch (err: any) {
        const msg = err?.message ?? String(err)
        this.logger.error(
          `Falha ao conectar no banco (tentativa ${attempt}/${maxAttempts}): ${msg}`,
        )

        if (attempt === maxAttempts) throw err

        const delay = baseDelayMs * attempt
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
}
