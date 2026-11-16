// Local, read-only staged rehearsal. Does not establish production capacity.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');

async function main() {
  const target = new URL(process.env.NEXO_LOAD_TARGET || 'http://127.0.0.1:3340/v1/');
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Loopback targets only');
  assert.equal(process.env.NEXO_LOAD_CONFIRM_ISOLATED, '1', 'Confirm an isolated synthetic dataset');
  const state = JSON.parse(fs.readFileSync(process.env.NEXO_LOAD_STORAGE_STATE, 'utf8'));
  const token = state.cookies.find(cookie => cookie.name === 'nexo_token')?.value;
  assert(token, 'A test login storage state is required');
  const pid = process.env.NEXO_LOAD_API_PID;
  assert(!pid || /^[1-9][0-9]*$/.test(pid), 'Invalid API process ID');
  const headers = { Authorization: `Bearer ${token}` };
  const get = path => fetch(new URL(path, target), { headers, redirect: 'error', signal: AbortSignal.timeout(5000) });
  const first = await get('customers?page=1&limit=8');
  assert.equal(first.status, 200, 'Preflight failed');
  let envelope = await first.json();
  while (envelope && !Array.isArray(envelope.data) && envelope.data) envelope = envelope.data;
  assert(Array.isArray(envelope?.data) && envelope.data.length, 'Seeded customer page required');
  const query = new URLSearchParams(envelope.data.map(customer => ['customerIds', customer.id]));
  const routes = ['customers?page=1&limit=8', 'appointments?page=1&limit=8', 'service-orders?page=1&limit=8', 'whatsapp/conversations?limit=20', `customers/operational-summary/page?${query}`];
  const stages = [{ name: 'baseline', clients: 5, seconds: 15 }, { name: 'ramp', clients: 10, seconds: 30 }, { name: 'peak', clients: 20, seconds: 45 }, { name: 'recovery', clients: 5, seconds: 20 }];
  const percentile = (values, p) => values.length ? Math.round([...values].sort((a,b) => a-b)[Math.ceil(values.length*p)-1]*100)/100 : null;
  const memory = [];
  const sampleMemory = stage => {
    if (!pid) return;
    try {
      const match = fs.readFileSync(`/proc/${pid}/status`, 'utf8').match(/^VmRSS:\s+(\d+)/m);
      if (match) memory.push({ stage, rssMiB: Math.round(Number(match[1])/1024*100)/100 });
    } catch { /* Process availability is also checked by HTTP. */ }
  };
  let unexpected = 0;
  const results = [];
  for (const stage of stages) {
    if (unexpected >= 5) break;
    const samples = [], began = performance.now(), deadline = Date.now() + stage.seconds*1000;
    sampleMemory(stage.name);
    const monitor = setInterval(() => sampleMemory(stage.name), 1000);
    try {
      await Promise.all(Array.from({ length: stage.clients }, async (_, worker) => {
        for (let iteration = 0; Date.now() < deadline && unexpected < 5; iteration++) {
          const index = (worker + iteration) % routes.length, start = performance.now();
          try {
            const response = await get(routes[index]);
            const bytes = (await response.arrayBuffer()).byteLength;
            samples.push({ index, status: response.status, ms: performance.now()-start, bytes });
            if (response.status !== 200 && response.status !== 429) unexpected++;
          } catch {
            unexpected++;
            samples.push({ index, status: 'transport_error', ms: performance.now()-start, bytes: 0 });
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }));
    } finally { clearInterval(monitor); }
    const durationMs = Math.round(performance.now()-began);
    const successful = samples.filter(sample => sample.status === 200);
    const summary = { ...stage, durationMs, requests: samples.length, observedRps: Math.round(samples.length/(durationMs/1000)*100)/100,
      statusCounts: Object.fromEntries([...new Set(samples.map(sample => sample.status))].map(status => [status, samples.filter(sample => sample.status === status).length])),
      p95SuccessMs: percentile(successful.map(sample => sample.ms), .95),
      routes: routes.map((route, index) => { const group = successful.filter(sample => sample.index === index); return { route: route.split('?')[0], successful: group.length, p50Ms: percentile(group.map(sample => sample.ms), .5), p95Ms: percentile(group.map(sample => sample.ms), .95), p99Ms: percentile(group.map(sample => sample.ms), .99), maxBytes: Math.max(0, ...group.map(sample => sample.bytes)) }; }),
    };
    results.push(summary);
    process.stderr.write(`${stage.name}: ${summary.requests} requests, p95=${summary.p95SuccessMs}ms\n`);
  }
  const result = { kind: 'bounded local staged read rehearsal', environment: 'development API, one organization, one process, warm database; not production capacity', stages: results, memory,
    unexpectedErrors: unexpected, pass: unexpected === 0 && results.length === stages.length && results.every(stage => stage.routes.every(route => route.successful > 0)) };
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
}
main().catch(() => { console.error('Staged rehearsal failed during setup; check local API, synthetic dataset and login state'); process.exitCode = 1; });
