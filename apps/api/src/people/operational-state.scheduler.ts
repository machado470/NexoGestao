import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { OperationalStateJob } from './operational-state.job'

function envBool(name: string, fallback = false): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  if (['1', 'true', 'yes', 'y', 'on'].includes(raw)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(raw)) return false
  return fallback
}

@Injectable()
export class OperationalStateScheduler {
  constructor(private readonly job: OperationalStateJob) {}

  @Cron('*/5 * * * *')
  async tick() {
    if (envBool('DISABLE_OPERATIONAL_STATE_SCHEDULE', false)) return
    await this.job.run()
  }
}
