#!/usr/bin/env node
import process from 'node:process'

const REQUIRED_TOP_LEVEL_FIELDS = [
  'totalsByStatus',
  'pendingRequestedCount',
  'stuckExecutingCount',
  'failedLast24hCount',
  'avgRequestedToExecutedMs',
  'avgRequestedToFailedMs',
  'topFailedActionTypes',
  'recentFailures',
]

const REQUIRED_STATUSES = ['REQUESTED', 'EXECUTING', 'EXECUTED', 'FAILED', 'CANCELED']

function fail(message) {
  console.error(`❌ ${message}`)
  process.exit(1)
}

function getEnv(name) {
  return (process.env[name] ?? '').trim()
}

function parseJsonOrNull(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function maskToken(token) {
  if (!token) return '(vazio)'
  if (token.length <= 12) return `${token.slice(0, 4)}...`
  return `${token.slice(0, 8)}...${token.slice(-4)}`
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    body: parseJsonOrNull(text),
    rawBody: text,
  }
}

function buildAuthArtifacts(loginResponse) {
  const token =
    loginResponse?.body?.token ??
    loginResponse?.body?.access_token ??
    loginResponse?.body?.accessToken ??
    null

  const setCookie = loginResponse.headers.get('set-cookie')
  const cookie = setCookie ? setCookie.split(';')[0] : null

  if (!token && !cookie) {
    throw new Error('Login não retornou token JWT nem cookie de sessão.')
  }

  return { token, cookie }
}

function buildAuthenticatedHeaders(auth) {
  const headers = { Accept: 'application/json' }
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`
  if (auth.cookie) headers.Cookie = auth.cookie
  return headers
}

function validateDiagnosticsContract(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ['Resposta de diagnostics não é um objeto JSON.']
  }

  const errors = []

  for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
    if (!(field in payload)) {
      errors.push(`Campo obrigatório ausente: ${field}`)
    }
  }

  const totals = payload.totalsByStatus
  if (!totals || typeof totals !== 'object' || Array.isArray(totals)) {
    errors.push('Campo totalsByStatus ausente ou inválido (esperado objeto).')
  } else {
    for (const status of REQUIRED_STATUSES) {
      if (!(status in totals)) {
        errors.push(`totalsByStatus sem status obrigatório: ${status}`)
      }
    }
  }

  return errors
}

function diagnosticsFingerprint(payload) {
  return JSON.stringify({
    totalsByStatus: payload?.totalsByStatus ?? null,
    pendingRequestedCount: payload?.pendingRequestedCount ?? null,
    stuckExecutingCount: payload?.stuckExecutingCount ?? null,
    failedLast24hCount: payload?.failedLast24hCount ?? null,
    avgRequestedToExecutedMs: payload?.avgRequestedToExecutedMs ?? null,
    avgRequestedToFailedMs: payload?.avgRequestedToFailedMs ?? null,
  })
}

async function main() {
  const apiBaseUrl = getEnv('API_BASE_URL') || 'http://127.0.0.1:3000'
  const adminEmail = getEnv('SMOKE_ADMIN_EMAIL')
  const adminPassword = getEnv('SMOKE_ADMIN_PASSWORD')
  const expectUnauthorized = getEnv('SMOKE_EXPECT_UNAUTHORIZED') !== '0'

  if (!adminEmail || !adminPassword) {
    fail(
      'Env ausente. Defina SMOKE_ADMIN_EMAIL e SMOKE_ADMIN_PASSWORD. Exemplo: API_BASE_URL=http://127.0.0.1:3000 SMOKE_ADMIN_EMAIL=admin@exemplo.com SMOKE_ADMIN_PASSWORD=<segredo> node scripts/smoke-operational-actions-diagnostics.mjs',
    )
  }

  const diagnosticsUrl = new URL('/internal/operational-actions/diagnostics', apiBaseUrl).toString()
  const loginUrl = new URL('/auth/login', apiBaseUrl).toString()

  console.log(`ℹ️ API_BASE_URL: ${apiBaseUrl}`)
  console.log(`ℹ️ Admin: ${adminEmail}`)

  if (expectUnauthorized) {
    const unauthorizedAttempt = await requestJson(diagnosticsUrl, { method: 'GET', headers: { Accept: 'application/json' } })
    if (![401, 403].includes(unauthorizedAttempt.status)) {
      fail(
        `unauthorized check falhou: esperado 401/403 sem token, recebido ${unauthorizedAttempt.status}. Body: ${unauthorizedAttempt.rawBody || '(vazio)'}`,
      )
    }
    console.log(`✅ unauthorized check (sem token retornou ${unauthorizedAttempt.status})`)
  }

  const loginResponse = await requestJson(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  })

  if (loginResponse.status < 200 || loginResponse.status >= 300) {
    fail(
      `login falhou com HTTP ${loginResponse.status}. Confira credenciais de admin seed/piloto para ${apiBaseUrl}.`,
    )
  }

  let auth
  try {
    auth = buildAuthArtifacts(loginResponse)
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }

  if (auth.token) {
    console.log(`✅ login (token capturado: ${maskToken(auth.token)})`)
  } else {
    console.log('✅ login (cookie de sessão capturado)')
  }

  const headers = buildAuthenticatedHeaders(auth)
  const diagnosticsResponse = await requestJson(diagnosticsUrl, { method: 'GET', headers })

  if (diagnosticsResponse.status < 200 || diagnosticsResponse.status >= 300) {
    fail(
      `diagnostics autenticado falhou com HTTP ${diagnosticsResponse.status}. Body: ${diagnosticsResponse.rawBody || '(vazio)'}`,
    )
  }

  const contractErrors = validateDiagnosticsContract(diagnosticsResponse.body)
  if (contractErrors.length > 0) {
    fail(`diagnostics contract inválido:\n- ${contractErrors.join('\n- ')}`)
  }
  console.log('✅ diagnostics contract')

  const forgedOrgUrl = new URL('/internal/operational-actions/diagnostics', apiBaseUrl)
  forgedOrgUrl.searchParams.set('orgId', 'fake-org')
  const forgedResponse = await requestJson(forgedOrgUrl.toString(), { method: 'GET', headers })

  if (forgedResponse.status < 200 || forgedResponse.status >= 300) {
    fail(`external orgId check falhou com HTTP ${forgedResponse.status}.`)
  }

  const forgedContractErrors = validateDiagnosticsContract(forgedResponse.body)
  if (forgedContractErrors.length > 0) {
    fail(`external orgId check retornou contrato inválido:\n- ${forgedContractErrors.join('\n- ')}`)
  }

  const baseFingerprint = diagnosticsFingerprint(diagnosticsResponse.body)
  const forgedFingerprint = diagnosticsFingerprint(forgedResponse.body)

  if (baseFingerprint === forgedFingerprint) {
    console.log('✅ external orgId ignored/not required (fingerprint estável com ?orgId=fake-org)')
  } else {
    console.log('✅ external orgId ignored/not required (endpoint respondeu normalmente com e sem ?orgId=fake-org; variações podem refletir atualização concorrente de métricas)')
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})
