import {
  Injectable,
  OnModuleInit,
  Logger,
  ForbiddenException,
} from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'
import { ClsService } from 'nestjs-cls'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name)

  private readonly orgScopedModels = new Set<string>(
    (((Prisma as any).dmmf?.datamodel?.models as any[]) ?? [])
      .filter((model) => model.fields.some((field: any) => field.name === 'orgId'))
      .map((model) => model.name),
  )

  constructor(private readonly cls: ClsService) {
    super()
  }

  async onModuleInit() {
    const maxAttempts = 12
    const baseDelayMs = 500

    this.$use(async (params, next) => {
      const orgId = this.cls.get('orgId')
      const isHttpRequest = this.cls.get('isHttpRequest')
      const allowWithoutOrg = this.cls.get('allowWithoutOrg')
      const model = params.model
      const isOrgScopedModel = Boolean(model && this.orgScopedModels.has(model))

      if (isOrgScopedModel && isHttpRequest && !orgId && !allowWithoutOrg) {
        throw new ForbiddenException('Contexto de organização ausente na requisição.')
      }

      if (!isOrgScopedModel || !orgId) {
        return next(params)
      }

      const args = params.args ?? {}
      params.args = args

      if (
        ['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(
          params.action,
        )
      ) {
        args.where = { ...(args.where ?? {}), orgId }
      }

      if (['create', 'createMany'].includes(params.action)) {
        if (Array.isArray(args.data)) {
          args.data = args.data.map((item: Record<string, unknown>) => ({
            ...item,
            orgId,
          }))
        } else {
          args.data = { ...(args.data ?? {}), orgId }
        }
      }

      if (['update', 'updateMany', 'upsert', 'delete', 'deleteMany'].includes(params.action)) {
        args.where = { ...(args.where ?? {}), orgId }

        if (params.action === 'upsert') {
          args.create = { ...(args.create ?? {}), orgId }
          args.update = { ...(args.update ?? {}) }
        }
      }

      return next(params)
    })

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.$connect()
        this.logger.log(`Prisma conectado (tentativa ${attempt}/${maxAttempts})`)
        return
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
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
