import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const script = fileURLToPath(new URL('./backup-status.sh', import.meta.url));
function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), 'nexo-backup-check-'));
  const stamp = new Date(Date.now() - 10000).toISOString();
  const state = {schemaVersion:1, startedAt:stamp, finishedAt:stamp, result:'success', localBackup:'created', offsiteUpload:'skipped', exitCode:0, reasonCode:'BACKUP_SUCCESS', artifactName:'synthetic.sql.gz'};
  const save = (value, file) => writeFileSync(join(dir,file), JSON.stringify(value)+'\n');
  const both = value => { save(value,'last-attempt.json'); save(value,'last-success.json'); };
  const check = (args=['--check','--max-age-seconds','60']) => spawnSync('bash',[script,...args],{encoding:'utf8',env:{...process.env,BACKUP_STATE_DIR:dir}});
  try { run({state,save,both,check}); } finally {rmSync(dir,{recursive:true,force:true});}
}
for (const [name, mutate, expected] of [
  ['recent local success',s=>s,'BACKUP_CHECK_PASSED'],
  ['stale backup',s=>({...s,startedAt:'2020-01-01T00:00:00Z',finishedAt:'2020-01-01T00:00:00Z'}),'BACKUP_STALE'],
  ['failed last attempt',s=>({...s,result:'failure',exitCode:23,localBackup:'failed'}),'BACKUP_LAST_ATTEMPT_FAILED'],
  ['future timestamp',s=>({...s,startedAt:'2099-01-01T00:00:00Z',finishedAt:'2099-01-01T00:00:00Z'}),'BACKUP_ATTEMPT_UNAVAILABLE'],
  ['invalid timestamp',s=>({...s,finishedAt:'invalid'}),'BACKUP_ATTEMPT_UNAVAILABLE'],
  ['success without created dump',s=>({...s,localBackup:'failed'}),'BACKUP_ATTEMPT_UNAVAILABLE'],
]) test(name,()=>fixture(({state,both,check})=>{both(mutate(state));const r=check(),body=JSON.parse(r.stdout);assert.equal(body.reasonCode,expected);assert.equal(r.status,expected==='BACKUP_CHECK_PASSED'?0:1);}));
test('requires explicit age policy',()=>fixture(({check})=>{for(const value of ['0','-1','1.5','NaN','Infinity','9007199254740992'])assert.equal(check(['--check','--max-age-seconds',value]).status,64);assert.equal(check(['--check']).status,64);assert.equal(check(['--unknown']).status,64);}));
test('missing or corrupt state fails without copying raw data',()=>fixture(({save,check})=>{assert.equal(check().status,1);save({secret:'never-print-this'},'last-attempt.json');const r=check();assert.equal(r.status,1);assert(!r.stdout.includes('never-print-this'));}));
test('requires a matching success snapshot',()=>fixture(({state,save,both,check})=>{save(state,'last-attempt.json');assert.equal(JSON.parse(check().stdout).reasonCode,'BACKUP_SUCCESS_UNAVAILABLE');both(state);save({...state,offsiteUpload:'uploaded'},'last-success.json');assert.equal(JSON.parse(check().stdout).reasonCode,'BACKUP_STATE_INCONSISTENT');}));
test('offsite requirement is opt-in and must be confirmed',()=>fixture(({state,both,check})=>{const args=['--check','--max-age-seconds','60','--require-offsite'];both(state);assert.equal(JSON.parse(check(args).stdout).reasonCode,'BACKUP_OFFSITE_UNCONFIRMED');both({...state,offsiteUpload:'uploaded'});assert.equal(check(args).status,0);}));
test('a recent failed attempt is not masked by an older success',()=>fixture(({state,both,save,check})=>{both(state);save({...state,result:'failure',localBackup:'failed',exitCode:23},'last-attempt.json');assert.equal(JSON.parse(check().stdout).reasonCode,'BACKUP_LAST_ATTEMPT_FAILED');}));
test('default mode preserves the original factual JSON',()=>fixture(({state,save,check})=>{save(state,'last-attempt.json');const r=check([]);assert.equal(r.status,0);assert.equal(r.stdout,JSON.stringify(state)+'\n');}));
