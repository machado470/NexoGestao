import { EventEmitter } from 'node:events'
import { NotificationsController } from './notifications.controller'
import { NotificationStreamHub } from './notification-stream-hub.service'

const notification = { version: 1 as const, kind: 'notification.created' as const, orgId: 'org', userId: 'user', eventId: 'recipient_1', notificationId: 'notification_1', createdAt: '2026-11-12T00:00:00.000Z' }
describe('Open notification stream session revocation', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-11-12T12:00:00Z')) })
  afterEach(() => jest.useRealTimers())
  function fixture(marker?: string) {
    let persisted: any = { id: 'user', orgId: 'org', role: 'ADMIN', active: true, sessionVersion: 0, person: { id: 'person', active: true } }
    const db = { user: { findUnique: jest.fn(async () => persisted) }, notificationRecipient: { findFirst: jest.fn(), findMany: jest.fn() } }
    const req: any = new EventEmitter(); req.headers = marker ? { 'last-event-id': marker } : {}; req.user = { sub: 'user', userId: 'user', orgId: 'org', role: 'ADMIN', personId: 'person', sessionVersion: 0, exp: Date.now() / 1000 + 3600 }
    const frames: string[] = [], hub = new NotificationStreamHub(), res: any = new EventEmitter()
    res.set = jest.fn(); res.flushHeaders = jest.fn(); res.writableEnded = false; res.destroyed = false
    res.write = jest.fn((frame: string) => { frames.push(frame); return true })
    res.end = jest.fn(() => { res.writableEnded = true; res.emit('close') })
    const controller = new NotificationsController({} as any, db as any, hub)
    return { req, res, db, hub, frames, controller, user: () => persisted, removeUser: () => { persisted = null } }
  }
  it.each([
    ['session version', (f: ReturnType<typeof fixture>) => f.user().sessionVersion++],
    ['user inactive', (f: ReturnType<typeof fixture>) => { f.user().active = false }],
    ['person inactive', (f: ReturnType<typeof fixture>) => { f.user().person.active = false }],
    ['person missing', (f: ReturnType<typeof fixture>) => { f.user().person = null }],
    ['person reassigned', (f: ReturnType<typeof fixture>) => { f.user().person.id = 'other-person' }],
    ['role changed', (f: ReturnType<typeof fixture>) => { f.user().role = 'VIEWER' }],
    ['tenant changed', (f: ReturnType<typeof fixture>) => { f.user().orgId = 'other-org' }],
    ['user removed', (f: ReturnType<typeof fixture>) => f.removeUser()],
  ] as const)('closes before the next event after %s', async (_label, revoke) => {
    const f = fixture(); await f.controller.stream(f.req, f.res); expect(f.hub.count()).toBe(1)
    await f.hub.deliver(notification); expect(f.frames.some(x => x.includes('recipient_1'))).toBe(true)
    revoke(f); const previous = f.frames.length
    await f.hub.deliver({ ...notification, eventId: 'recipient_2' })
    expect(f.frames).toHaveLength(previous); expect(f.res.end).toHaveBeenCalledTimes(1); expect(f.hub.count()).toBe(0); expect(jest.getTimerCount()).toBe(0)
  })
  it('closes an idle revoked connection at the heartbeat without writing another frame', async () => {
    const f = fixture(); await f.controller.stream(f.req, f.res); f.user().sessionVersion++
    await jest.advanceTimersByTimeAsync(25000)
    expect(f.frames).toHaveLength(1); expect(f.res.writableEnded).toBe(true); expect(f.hub.count()).toBe(0); expect(jest.getTimerCount()).toBe(0)
  })
  it('keeps valid heartbeats and removes all timers on disconnect', async () => {
    const f = fixture(); await f.controller.stream(f.req, f.res); await jest.advanceTimersByTimeAsync(25000)
    expect(f.frames.at(-1)).toBe(': heartbeat\n\n'); expect(f.hub.count()).toBe(1)
    f.res.emit('close'); expect(f.hub.count()).toBe(0); expect(jest.getTimerCount()).toBe(0)
  })
  it('fails closed when the session database is unavailable', async () => {
    const f = fixture(); await f.controller.stream(f.req, f.res); f.db.user.findUnique.mockRejectedValue(new Error('database unavailable'))
    await f.hub.deliver(notification); expect(f.frames).toHaveLength(1); expect(f.hub.count()).toBe(0); expect(jest.getTimerCount()).toBe(0)
  })
  it('does not replay persisted notifications if the session is revoked while replay loads', async () => {
    const f = fixture('recipient_cursor')
    f.db.notificationRecipient.findFirst.mockResolvedValue({ id: 'recipient_cursor', createdAt: new Date() })
    f.db.notificationRecipient.findMany.mockImplementation(async () => { f.user().sessionVersion++; return [{ id: 'recipient_1', userId: 'user', createdAt: new Date(), notification: { id: 'notification_1', orgId: 'org' } }] })
    await f.controller.stream(f.req, f.res)
    expect(f.frames).toHaveLength(0); expect(f.hub.count()).toBe(0); expect(jest.getTimerCount()).toBe(0)
  })
  it('cleans up a replay query failure after headers were sent', async () => {
    const f = fixture('recipient_cursor'); f.db.notificationRecipient.findFirst.mockRejectedValue(new Error('database unavailable'))
    await expect(f.controller.stream(f.req, f.res)).resolves.toBeUndefined()
    expect(f.hub.count()).toBe(0); expect(f.res.writableEnded).toBe(true); expect(jest.getTimerCount()).toBe(0)
  })
  it('preserves replay order and deduplicates buffered live events', async () => {
    const f = fixture('recipient_cursor')
    f.db.notificationRecipient.findFirst.mockResolvedValue({ id: 'recipient_cursor', createdAt: new Date() })
    f.db.notificationRecipient.findMany.mockImplementation(async () => {
      await f.hub.deliver({ ...notification, eventId: 'recipient_2' })
      await f.hub.deliver({ ...notification, eventId: 'recipient_3' })
      return ['recipient_1', 'recipient_2'].map(id => ({ id, userId: 'user', createdAt: new Date(), notification: { id: 'notification_1', orgId: 'org' } }))
    })
    await f.controller.stream(f.req, f.res)
    expect(f.frames.map(frame => frame.match(/^id: (.*)/)?.[1])).toEqual(['recipient_1', 'recipient_2', 'recipient_3'])
    f.res.emit('close'); expect(jest.getTimerCount()).toBe(0)
  })
  it('revalidates buffered events after backpressure before writing them', async () => {
    const f = fixture(); await f.controller.stream(f.req, f.res)
    let firstWritten!: () => void
    const written = new Promise<void>(resolve => { firstWritten = resolve })
    const original = f.res.write.getMockImplementation()
    f.res.write.mockImplementation((frame: string) => {
      original(frame)
      if (frame.includes('recipient_1')) { firstWritten(); return false }
      return true
    })
    const first = f.hub.deliver(notification); await written
    const second = f.hub.deliver({ ...notification, eventId: 'recipient_2' })
    f.user().sessionVersion++; f.res.emit('drain'); await Promise.all([first, second])
    expect(f.frames.join('')).not.toContain('recipient_2'); expect(f.hub.count()).toBe(0); expect(jest.getTimerCount()).toBe(0)
  })
  it('expires the JWT even without notifications or heartbeat', async () => {
    const f = fixture(); f.req.user.exp = (Date.now() + 1000) / 1000; await f.controller.stream(f.req, f.res)
    await jest.advanceTimersByTimeAsync(1001)
    expect(f.res.writableEnded).toBe(true); expect(f.hub.count()).toBe(0); expect(jest.getTimerCount()).toBe(0)
  })
})
