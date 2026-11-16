// Baseline assertions for commit d9d1ce07, before the capacity fixes.
// Expected to fail after fixes; current behavior is verified by the new regression tests.
// No HTTP/database/provider calls.
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../..');
const api = name => require(path.join(root, 'apps/api/dist', name));
(async () => {
  const { TenantOperationsService } = api('common/tenant-ops/tenant-ops.service.js');
  const input = { orgId: 'audit-only', scope: 'test', limit: 2, windowMs: 60000, blockedReason: 'limited' };
  const a = new TenantOperationsService(), b = new TenantOperationsService();
  assert(a.enforceLimit(input).allowed);
  assert(a.enforceLimit(input).allowed);
  assert(!a.enforceLimit(input).allowed);
  assert(b.enforceLimit(input).allowed);

  const { MetricsService } = api('common/metrics/metrics.service.js');
  const { RequestLoggerMiddleware } = api('common/middleware/request-logger.middleware.js');
  const metrics = new MetricsService(), middleware = new RequestLoggerMiddleware(metrics);
  for (let i = 0; i < 1000; i++) metrics.incrementRequestByEndpoint(middleware.endpointKey('GET', `/nonexistent-audit-${i}`));
  assert.equal(Object.keys(metrics.snapshot().requestsByEndpoint).length, 1000);

  const { WhatsAppConversationReadService } = api('whatsapp/whatsapp-conversation-read.service.js');
  let messagesQuery;
  await new WhatsAppConversationReadService({ whatsAppMessage: { findMany: async args => { messagesQuery = args; return []; } } }).getMessages('audit-only', 'conversation-only');
  assert(!('take' in messagesQuery));
  assert(!('cursor' in messagesQuery));

  const { MemoryCacheService } = api('common/cache/memory-cache.service.js');
  const cache = new MemoryCacheService();
  let calls = 0;
  await Promise.all(Array.from({ length: 20 }, () => cache.getOrSet('audit-only', async () => { calls++; await Promise.resolve(); return 'value'; }, 1000)));
  assert.equal(calls, 20);

  const { CustomersOperationalSummaryService } = api('customers/customers-operational-summary.service.js');
  const customers = Array.from({ length: 501 }, (_, i) => ({ id: `fictitious-${i}`, name: `Fictitious ${i}`, active: true, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') }));
  const db = { customer: { findMany: async ({ take }) => customers.slice(0, take) } };
  for (const name of ['charge', 'payment', 'serviceOrder', 'appointment', 'whatsAppMessage', 'whatsAppConversation', 'timelineEvent']) db[name] = { findMany: async () => [] };
  const summary = await new CustomersOperationalSummaryService(db).getSummary('audit-only', new Date('2026-11-11'));
  assert.equal(summary.portfolio.totalCustomers, 500);

  const { AppointmentsService } = api('appointments/appointments.service.js');
  let take;
  await new AppointmentsService({ appointment: { findMany: async args => { take = args.take; return []; }, count: async () => 0 } }).list('audit-only', { limit: 1000000 });
  assert.equal(take, 1000000);
  console.log('PASS: six service-level reproductions; no capacity or latency measurement.');
})().catch(error => { console.error(error); process.exitCode = 1; });
