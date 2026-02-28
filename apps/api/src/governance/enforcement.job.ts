import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { EnforcementEngineService } from './enforcement-engine.service'
import { GovernanceRunService } from './governance-run.service'

const ENFORCEMENT_LOCK_KEY = 910077

function envInt(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim()
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

@Injectable()
export class EnforcementJob {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,

    @Inject(EnforcementEngineService)
    private readonly engine: EnforcementEngineService,

    @Inject(GovernanceRunService)
    private readonly runService: GovernanceRunService,
  ) {}

  async run() {
    // 1) trava concorrência entre processos/pods
    const locked = await this.tryAcquireLock()
    if (!locked) {
      console.log('[EnforcementJob] Execução ignorada: lock já está em uso.')
      return
    }

    try {
      // (teste) segura lock propositalmente
      const lockHoldMs = envInt('ENFORCEMENT_LOCK_HOLD_MS', 0)
      if (lockHoldMs > 0) {
        console.log(`[EnforcementJob] lock hold ${lockHoldMs}ms (teste)`)
        await sleep(lockHoldMs)
      }

      // 2) debounce (anti “double tap”)
      const debounceSeconds = envInt('ENFORCEMENT_DEBOUNCE_SECONDS', 60)
      const debounceFrom = new Date(Date.now() - debounceSeconds * 1000)

      const orgs = await this.prisma.organization.findMany({
        select: { id: true },
      })

      for (const org of orgs) {
        const recent = await this.prisma.governanceRun.findFirst({
          where: {
            orgId: org.id,
            startedAt: { gte: debounceFrom },
          },
          orderBy: { startedAt: 'desc' },
          select: { id: true, startedAt: true },
        })

        if (recent) {
          console.log(
            `[EnforcementJob] Org ${org.id}: ignorado (debounce ${debounceSeconds}s). lastStartedAt=${recent.startedAt.toISOString()}`,
          )
          continue
        }

        this.runService.startRun(org.id)
        await this.engine.runForOrg(org.id)
        await this.runService.finish(org.id)
      }
    } finally {
      await this.releaseLock()
    }
  }

  private async tryAcquireLock(): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ locked: boolean }>>(
      `select pg_try_advisory_lock(${ENFORCEMENT_LOCK_KEY}) as locked`,
    )
    return !!rows?.[0]?.locked
  }

  private async releaseLock(): Promise<void> {
    await this.prisma.$queryRawUnsafe(
      `select pg_advisory_unlock(${ENFORCEMENT_LOCK_KEY})`,
    )
  }
}
