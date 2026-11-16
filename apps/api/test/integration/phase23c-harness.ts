import { execFileSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import IORedis from 'ioredis'

const composeFile = '../../docker-compose.phase23c-test.yml'

function recoveryProject() {
  const project = process.env.PHASE23C_COMPOSE_PROJECT ?? 'nexogestao-phase23c'
  if (!/^nexogestao-phase23c(?:-[a-f0-9]{32})?$/.test(project)) throw new Error('Refusing destructive test: invalid recovery project')
  return project
}

export function assertDedicatedPhase23cInfrastructure() {
  const project = recoveryProject()
  const database = new URL(process.env.DATABASE_URL ?? '')
  const redis = new URL(process.env.REDIS_URL ?? '')
  const postgresPort = process.env.PHASE23C_POSTGRES_PORT ?? '55433'
  const redisPort = process.env.PHASE23C_REDIS_PORT ?? '56380'
  const validPort = (value: string) => /^[1-9][0-9]{0,4}$/.test(value) && Number(value) <= 65535
  if (!validPort(postgresPort) || database.hostname !== '127.0.0.1' || database.port !== postgresPort || database.pathname !== '/phase23c' || database.username !== 'phase23c') {
    throw new Error('Refusing destructive test: DATABASE_URL is not the dedicated Phase 2.3C database')
  }
  if (!validPort(redisPort) || redis.hostname !== '127.0.0.1' || redis.port !== redisPort || redis.pathname !== '/15') {
    throw new Error('Refusing destructive test: REDIS_URL is not the dedicated Phase 2.3C Redis namespace')
  }
  // Inspect configured bindings, which remain available even while a service is
  // stopped. Matching environment strings alone must never authorize stop/start.
  for (const [service, internalPort, publishedPort] of [
    ['postgres-phase23c', '5432/tcp', postgresPort], ['redis-phase23c', '6379/tcp', redisPort],
  ]) {
    const id = execFileSync('docker', ['compose', '-p', project, '-f', composeFile, 'ps', '--all', '--quiet', service], { encoding: 'utf8', timeout: 15000 }).trim()
    if (!/^[a-f0-9]{12,64}$/.test(id)) throw new Error('Refusing destructive test: dedicated container not found')
    const bindings = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .HostConfig.PortBindings}}', id], { encoding: 'utf8', timeout: 15000 }))
    const expected = bindings?.[internalPort]
    if (!Array.isArray(expected) || expected.length !== 1 || expected[0].HostIp !== '127.0.0.1' || expected[0].HostPort !== publishedPort) {
      throw new Error('Refusing destructive test: endpoint does not match dedicated container binding')
    }
  }
}

export function compose(service: 'postgres-phase23c' | 'redis-phase23c', action: 'stop' | 'start') {
  assertDedicatedPhase23cInfrastructure()
  execFileSync('docker', ['compose', '-p', recoveryProject(), '-f', composeFile, action, service], {
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

export async function waitRedisClientsReady(connections: Iterable<IORedis>, timeoutMs = 20_000) {
  return eventually(
    async () => Array.from(connections, (connection) => connection.status),
    (statuses) => statuses.length > 0 && statuses.every((status) => status === 'ready' || status === 'connect'),
    timeoutMs,
  )
}

/** Redis readiness probe. Unlike a producer, this connection may queue its PING
 * while the initial connection is being established. One client is retained for
 * the whole wait and is always disconnected by the harness. */
export async function waitRedisReachable(redisUrl: string, timeoutMs = 20_000): Promise<void> {
  const connection = new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 1_000,
  })
  let timer: NodeJS.Timeout | undefined

  try {
    await Promise.race([
      connection.connect(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Redis did not become ready in ${timeoutMs}ms`)), timeoutMs)
      }),
    ])
    const reply = await connection.ping()
    if (reply !== 'PONG') throw new Error(`Unexpected Redis PING reply: ${reply}`)
  } finally {
    if (timer) clearTimeout(timer)
    connection.disconnect()
  }
}
