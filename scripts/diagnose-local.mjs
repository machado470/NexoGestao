#!/usr/bin/env node
// Local collection only. Authentication may register a LOGIN usage event.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function summarize(body, trpc = false) {
  if (trpc) {
    if (body?.error) return { state: 'ERROR', code: body.error.json?.data?.code ?? 'TRPC_ERROR' }
    body = body?.result?.data?.json ?? body?.result?.data
  }
  if (body?.success === false) return { state: 'ERROR', code: 'API_ERROR' }
  if (body?.success === true && 'data' in body) body = body.data
  if (body == null) return { state: 'INVALID_RESPONSE' }
  const result = { state: 'OK' }
  const rows = Array.isArray(body) ? body : [body.items, body.customers, body.data, body.charges, body.appointments, body.serviceOrders].find(Array.isArray)
  if (rows) { result.returned = rows.length; result.state = rows.length ? 'DATA' : 'EMPTY_PAGE' }
  const total = body.total ?? body.meta?.total ?? body.pagination?.total
  if (Number.isInteger(total)) result.total = total
  // Only known technical scalar fields; never include records, names, messages or credentials.
  for (const key of ['availability', 'operationalState', 'evaluatedRecords', 'status', 'configured', 'providerConfigured']) {
    if (typeof body[key] === 'boolean' || typeof body[key] === 'number' || (typeof body[key] === 'string' && /^[A-Z_]+$/.test(body[key]))) result[key] = body[key]
  }
  return result
}

async function check(url, headers = {}, trpc = false) {
  try {
    const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(10000) })
    let body
    try { body = await response.json() } catch { return { http: response.status, state: response.ok ? 'NON_JSON' : 'HTTP_ERROR' } }
    return { http: response.status, ...(response.ok ? summarize(body, trpc) : { state: 'HTTP_ERROR' }) }
  } catch { return { http: null, state: 'TRANSPORT_ERROR' } }
}

function localUrl(value) {
  const url = new URL(value)
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.protocol !== 'http:' || url.username || url.password) throw new Error('Use somente URLs HTTP locais.')
  return url
}

async function main() {
  process.chdir(root)
  try { process.loadEnvFile('.env') } catch (error) { if (error.code !== 'ENOENT') throw new Error('Não foi possível carregar .env.') }
  if (process.env.NODE_ENV === 'production') throw new Error('Diagnóstico destinado ao desenvolvimento local.')
  const api = localUrl(process.env.NEXO_API_URL || `http://127.0.0.1:${process.env.API_PORT || 3000}`)
  api.pathname = `${api.pathname.replace(/\/$/, '').replace(/\/v1$/, '')}/v1/`
  const web = localUrl(`http://127.0.0.1:${process.env.WEB_PORT || 3010}`)
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
  const report = { generatedAt: new Date().toISOString(), code: { branch: git('branch', '--show-current'), commit: git('rev-parse', 'HEAD'), trackedChanges: Boolean(git('status', '--porcelain', '--untracked-files=no')) }, http: {} }
  report.http.apiHealth = await check(new URL('health', api))
  report.http.web = await check(new URL('/api/trpc/session.me', web), {}, true)
  console.log('Entre com a mesma conta usada no navegador. A senha não será exibida nem salva.\nO login pode registrar um evento de acesso; a coleta não altera os dados operacionais.')
  const input = spawnSync('bash', ['-c', 'read -r -p "E-mail: " email </dev/tty; read -r -s -p "Senha: " password </dev/tty; printf "\\n" >/dev/tty; printf "%s\\n%s" "$email" "$password"'], { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] })
  if (input.status !== 0) throw new Error('Execute em um terminal interativo do WSL.')
  const [email, password] = input.stdout.split('\n')
  input.stdout = ''
  let token, orgId
  try {
    const response = await fetch(new URL('auth/login', api), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), redirect: 'error', signal: AbortSignal.timeout(10000) })
    report.http.login = { http: response.status, state: response.ok ? 'OK' : 'HTTP_ERROR' }
    if (response.ok) { const raw = await response.json(); const body = raw.data ?? raw; token = body.token; orgId = body.user?.orgId }
  } catch { report.http.login = { http: null, state: 'TRANSPORT_ERROR' } }
  if (typeof token === 'string' && typeof orgId === 'string') {
    report.scope = { orgId }
    const headers = { Authorization: `Bearer ${token}` }
    for (const endpoint of ['me', 'customers', 'appointments', 'service-orders', 'finance/charges', 'whatsapp/health']) report.http[`api:${endpoint}`] = await check(new URL(endpoint, api), headers)
    const cookies = { Cookie: `nexo_token=${encodeURIComponent(token)}` }
    for (const procedure of ['session.me', 'customers.list', 'appointments.list', 'serviceOrders.list', 'finance.charges.list', 'dashboard.operationalState', 'dashboard.operationalSignals', 'whatsapp.health', 'operations.tenantSummary']) {
      const url = new URL(`/api/trpc/${procedure}`, web)
      url.searchParams.set('input', JSON.stringify({ json: {} }))
      report.http[`bff:${procedure}`] = await check(url, cookies, true)
    }
    token = undefined
    let prisma
    try {
      const databaseUrl = new URL(process.env.DATABASE_URL)
      if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) throw new Error('NON_LOCAL_DATABASE')
      prisma = new PrismaClient({ log: [] })
      report.database = await prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
        const counts = {}
        for (const model of ['user', 'person', 'customer', 'appointment', 'serviceOrder', 'charge', 'payment', 'governanceRun']) counts[model] = await tx[model].count({ where: { orgId } })
        const governance = await tx.governanceRun.findFirst({ where: { orgId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, evaluated: true } })
        const risk = await tx.riskSnapshot.findFirst({ where: { person: { orgId } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
        return { state: 'OK', counts, latestGovernance: governance, latestRisk: risk }
      }, { timeout: 15000 })
    } catch { report.database = { state: 'UNAVAILABLE', counts: null } } finally { if (prisma) await prisma.$disconnect() }
  } else { report.database = { state: 'NOT_CHECKED', counts: null } }
  const destination = path.join(root, 'work', 'diagnostico-local.json')
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nRelatório salvo em ${destination}. Copie o JSON para a conversa.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Coleta interrompida. Verifique o terminal, Node >= 20.12 e .env local; nenhum segredo foi impresso.'); process.exitCode = 1 })
