import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name)

  async onModuleInit() {
    const maxAttempts = 12
    const baseDelayMs = 500

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
