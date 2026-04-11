import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ExecutionRunner } from './execution.runner'

function envBool(name: string, fallback = false): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  if (['1', 'true', 'yes', 'y', 'on'].includes(raw)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(raw)) return false
  return fallback
}

@Injectable()
export class ExecutionScheduler {
  constructor(private readonly runner: ExecutionRunner) {}

  @Cron('*/10 * * * * *')
  async tick() {
    if (envBool('DISABLE_EXECUTION_RUNNER', false)) return
    await this.runner.runOnce()
  }
}
