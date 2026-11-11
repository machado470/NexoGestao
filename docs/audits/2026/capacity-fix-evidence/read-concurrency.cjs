// Bounded read-only smoke for an isolated loopback environment, not a capacity benchmark.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const target = new URL(process.env.NEXO_LOAD_TARGET || 'http://127.0.0.1:3340/v1/');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Only loopback test targets are accepted');
assert.equal(process.env.NEXO_LOAD_CONFIRM_ISOLATED, '1', 'Use an isolated fictitious dataset');
const state = JSON.parse(fs.readFileSync(process.env.NEXO_LOAD_STORAGE_STATE, 'utf8'));
const token = state.cookies.find(cookie => cookie.name === 'nexo_token')?.value;
assert(token, 'Test login storage state is required');
const vus = Math.min(20, Math.max(1, Number(process.env.NEXO_LOAD_VUS) || 5));
const perWorker = Math.min(100, Math.max(1, Number(process.env.NEXO_LOAD_ITERATIONS) || 30));
const routes = ['customers?page=1&limit=8', 'appointments?page=1&limit=8', 'service-orders?page=1&limit=8', 'whatsapp/conversations?limit=20', 'customers/operational-summary'];
const samples = [];
let unexpected = 0;
const deadline = Date.now() + 60000;
const percentile = (values, p) => values.length ? Math.round([...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1]*100)/100 : null;
(async () => {
  const start = performance.now();
  await Promise.all(Array.from({length:vus}, async (_, worker) => {
    for (let i=0; i<perWorker && Date.now()<deadline && unexpected<5; i++) {
      const route=routes[(worker+i)%routes.length], began=performance.now();
      try {
        const response=await fetch(new URL(route,target), {redirect:'error',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(5000)});
        const bytes=(await response.arrayBuffer()).byteLength;
        samples.push({route,status:response.status,ms:performance.now()-began,bytes});
        if(response.status>=400 && response.status!==429)unexpected++;
      } catch {unexpected++;samples.push({route,status:'transport_error',ms:performance.now()-began,bytes:0});}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
  }));
  const results={kind:'bounded API read-concurrency smoke; not a capacity result',environment:'local development API; not production throttling behavior',virtualClients:vus,requests:samples.length,durationMs:Math.round(performance.now()-start),unexpectedErrors:unexpected,statusCounts:Object.fromEntries([...new Set(samples.map(s=>s.status))].map(status=>[status,samples.filter(s=>s.status===status).length])),routes:routes.map(route=>{const group=samples.filter(s=>s.route===route);return {route,samples:group.length,p50Ms:percentile(group.map(s=>s.ms),.5),p95Ms:percentile(group.map(s=>s.ms),.95),p99Ms:percentile(group.map(s=>s.ms),.99),maxBytes:Math.max(0,...group.map(s=>s.bytes))};}),pass:unexpected===0 && samples.some(sample=>sample.status===200)};
  console.log(JSON.stringify(results,null,2));
  if(!results.pass)process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1});
