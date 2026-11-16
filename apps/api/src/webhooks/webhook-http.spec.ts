import { EventEmitter } from 'node:events'
import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { isPublicWebhookAddress, sendWebhook, validateWebhookUrl } from './webhook-http'
jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }))
jest.mock('node:https', () => ({ request: jest.fn() }))
const dns = lookup as jest.Mock
const https = request as jest.Mock

describe('Webhook destination security', () => {
  beforeEach(() => jest.clearAllMocks())
  it.each(['127.0.0.1', '10.0.0.1', '172.16.1.1', '192.168.1.1', '169.254.169.254',
    '0.0.0.0', '100.100.100.200', '224.0.0.1', '::1', '::ffff:127.0.0.1',
    'fc00::1', 'fe80::1', '2001:db8::1', '2002:7f00:1::1'])('rejects reserved address %s', address => {
    expect(isPublicWebhookAddress(address)).toBe(false)
  })
  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('allows public address %s', address => {
    expect(isPublicWebhookAddress(address)).toBe(true)
  })
  it.each(['http://example.com', 'https://localhost', 'https://127.1', 'https://[::1]',
    'https://user:pass@example.com', 'https://example.com:8443', 'https://example.com/#fragment'])('rejects unsafe URL %s', url => {
    expect(() => validateWebhookUrl(url)).toThrow()
  })
  it('blocks mixed public/private DNS answers without connecting', async () => {
    dns.mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '10.1.1.1', family: 4 }])
    await expect(sendWebhook('https://example.com/event', '{}', {})).rejects.toThrow('públicos')
    expect(https).not.toHaveBeenCalled()
  })
  const simulate = (status: number) => {
    dns.mockResolvedValue([{ address: '8.8.8.8', family: 4 }])
    https.mockImplementation((_url, _options, response) => {
      const req = Object.assign(new EventEmitter(), { end: () => response({ statusCode: status, resume: jest.fn() }) })
      return req
    })
  }
  it('pins validated DNS while keeping the original TLS hostname', async () => {
    simulate(204)
    await sendWebhook('https://example.com/event', '{}', { 'x-nexo-signature': 'test' })
    const [url, options] = https.mock.calls[0]
    expect(url.hostname).toBe('example.com')
    const callback = jest.fn()
    options.lookup('example.com', {}, callback)
    expect(callback).toHaveBeenCalledWith(null, '8.8.8.8', 4)
    expect(dns).toHaveBeenCalledTimes(1)
    expect(options.agent).toBe(false)
  })
  it('rejects redirects without making a second request', async () => {
    simulate(302)
    await expect(sendWebhook('https://example.com/event', '{}', {})).rejects.toThrow('302')
    expect(https).toHaveBeenCalledTimes(1)
  })
  it('fails closed when DNS is unavailable', async () => {
    dns.mockRejectedValue(new Error('DNS unavailable'))
    await expect(sendWebhook('https://example.com', '{}', {})).rejects.toThrow('DNS unavailable')
    expect(https).not.toHaveBeenCalled()
  })
})
