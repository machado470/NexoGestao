import { execFileSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const composeFile = '../../docker-compose.phase23c-test.yml'

export function assertDedicatedPhase23cInfrastructure() {
  const database = new URL(process.env.DATABASE_URL ?? '')
  const redis = new URL(process.env.REDIS_URL ?? '')
  if (database.hostname !== '127.0.0.1' || database.port !== '55433' || database.pathname !== '/phase23c') {
    throw new Error('Refusing destructive test: DATABASE_URL is not the dedicated Phase 2.3C database')
  }
  if (redis.hostname !== '127.0.0.1' || redis.port !== '56380' || redis.pathname !== '/15') {
    throw new Error('Refusing destructive test: REDIS_URL is not the dedicated Phase 2.3C Redis namespace')
  }
}

export function compose(service: 'postgres-phase23c' | 'redis-phase23c', action: 'stop' | 'start') {
  assertDedicatedPhase23cInfrastructure()
  execFileSync('docker', ['compose', '-p', 'nexogestao-phase23c', '-f', composeFile, action, service], {
    cwd: process.cwd(), stdio: 'inherit', timeout: 45_000,
  })
}

export async function eventually<T>(probe: () => Promise<T>, accept: (value: T) => boolean, timeoutMs = 20_000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  let latest: T
  do {
    try {
      latest = await probe()
      if (accept(latest)) return latest
    } catch (error) { latest = error as T }
    await delay(200)
  } while (Date.now() < deadline)
  throw new Error(`Condition not reached in ${timeoutMs}ms; latest=${String(latest!)}`)
}
