import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { BlockList, isIP } from 'node:net'
import { BadRequestException } from '@nestjs/common'

const blocked = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(address, prefix, 'ipv4')
const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')
blocked.addSubnet('2001::', 23, 'ipv6')
blocked.addSubnet('2001:db8::', 32, 'ipv6')
blocked.addSubnet('2002::', 16, 'ipv6')
blocked.addSubnet('3fff::', 20, 'ipv6')

export function isPublicWebhookAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return !blocked.check(address, 'ipv4')
  if (family === 6) return globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6')
  return false
}

export function validateWebhookUrl(raw: string): URL {
  let url: URL
  try { url = new URL(raw) } catch { throw new BadRequestException('URL de webhook inválida.') }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
      (url.port && url.port !== '443') || !hostname ||
      hostname === 'localhost' || hostname.endsWith('.localhost') ||
      (isIP(hostname) && !isPublicWebhookAddress(hostname))) {
    throw new BadRequestException('Webhook exige HTTPS na porta 443 e destino público, sem credenciais.')
  }
  return url
}

/** Resolve once, reject all private answers, and pin the checked address to the TLS connection. */
export async function sendWebhook(rawUrl: string, body: string, headers: Record<string, string>): Promise<void> {
  const url = validateWebhookUrl(rawUrl)
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(item => !isPublicWebhookAddress(item.address))) {
    throw new BadRequestException('Destino de webhook deve resolver somente para endereços públicos.')
  }
  const pinned = addresses[0]
  await new Promise<void>((resolve, reject) => {
    const req = request(url, {
      method: 'POST', agent: false, signal: AbortSignal.timeout(15000),
      headers: { ...headers, 'content-length': String(Buffer.byteLength(body)) },
      // TLS still validates the original hostname. No second DNS lookup is allowed.
      lookup: ((_host: string, options: any, callback: any) => {
        if (options?.all) callback(null, [pinned])
        else callback(null, pinned.address, pinned.family)
      }) as any,
    }, response => {
      response.resume()
      const status = response.statusCode ?? 0
      // Native https never follows redirects. Every redirect is a failed delivery.
      if (status < 200 || status >= 300) reject(new Error(`Webhook HTTP error status=${status}`))
      else resolve()
    })
    req.on('error', reject)
    req.end(body)
  })
}
