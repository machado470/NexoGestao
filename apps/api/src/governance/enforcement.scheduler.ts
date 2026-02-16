import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { EnforcementJob } from './enforcement.job'

function envBool(name: string, fallback = false): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  if (['1', 'true', 'yes', 'y', 'on'].includes(raw)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(raw)) return false
  return fallback
}

@Injectable()
export class EnforcementScheduler {
  constructor(private readonly job: EnforcementJob) {}

  @Cron('*/5 * * * *')
  async tick() {
    if (envBool('DISABLE_GOVERNANCE_SCHEDULE', false)) return
    await this.job.run()
  }
}
