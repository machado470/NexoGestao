import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'

const PILOT_ORG_SLUG = 'pilot-servicos-viva'
const PILOT_ORG_NAME = 'Serviços Viva - Ambiente Piloto'
const PILOT_ADMIN_EMAIL = 'admin.piloto@nexogestao.local'
const PILOT_ADMIN_NAME = 'Paula Almeida'
const PILOT_ADMIN_PASSWORD = 'Piloto@Admin123'

function shouldRunDevSeed() {
  const nodeEnv = (process.env.NODE_ENV ?? '').toLowerCase().trim()
  const seedEnabled = (process.env.NEXO_DEV_SEED ?? '').trim() === '1'
  const seedMode = (process.env.SEED_MODE ?? 'basic').trim().toLowerCase()

  return seedEnabled && nodeEnv !== 'production' && ['basic', 'pilot'].includes(seedMode)
}

@Injectable()
export class DevSeedService implements OnModuleInit {
  private readonly logger = new Logger(DevSeedService.name)

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (!shouldRunDevSeed()) {
      this.logger.log('[BOOT][DevSeed] seed explícito desabilitado (NEXO_DEV_SEED=1 SEED_MODE=basic para habilitar).')
      return
    }

    try {
      await this.ensurePilotAdmin()
    } catch (error) {
      this.logger.warn(
        `[BOOT][DevSeed] Falha ao garantir dados piloto; bootstrap seguirá em modo degradado: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private async ensurePilotAdmin() {
    const passwordHash = await bcrypt.hash(PILOT_ADMIN_PASSWORD, 10)

    await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.upsert({
        where: { slug: PILOT_ORG_SLUG },
        update: {
          name: PILOT_ORG_NAME,
          requiresOnboarding: false,
          timezone: 'America/Sao_Paulo',
          currency: 'BRL',
        },
        create: {
          slug: PILOT_ORG_SLUG,
          name: PILOT_ORG_NAME,
          requiresOnboarding: false,
          timezone: 'America/Sao_Paulo',
          currency: 'BRL',
        },
      })

      const existingUser = await tx.user.findUnique({
        where: { email: PILOT_ADMIN_EMAIL },
        select: { id: true },
      })

      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              orgId: org.id,
              role: 'ADMIN',
              active: true,
              password: passwordHash,
              emailVerifiedAt: new Date(),
            },
          })
        : await tx.user.create({
            data: {
              email: PILOT_ADMIN_EMAIL,
              password: passwordHash,
              role: 'ADMIN',
              active: true,
              emailVerifiedAt: new Date(),
              orgId: org.id,
            },
          })

      await tx.person.upsert({
        where: { userId: user.id },
        update: {
          orgId: org.id,
          name: PILOT_ADMIN_NAME,
          email: PILOT_ADMIN_EMAIL,
          role: 'ADMIN',
          active: true,
        },
        create: {
          name: PILOT_ADMIN_NAME,
          email: PILOT_ADMIN_EMAIL,
          role: 'ADMIN',
          active: true,
          orgId: org.id,
          userId: user.id,
        },
      })
    })

    this.logger.warn(
      `[BOOT][DevSeed] Seed básico verificado para ${PILOT_ADMIN_EMAIL} (${PILOT_ORG_SLUG}) em NODE_ENV!=production`,
    )
  }
}
