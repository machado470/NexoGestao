import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
const source=fileURLToPath(new URL('./run-production-backup.sh',import.meta.url));
for (const mode of ['local','invalid']) test(`concurrent ${mode} invocation cannot overwrite in-flight state`,async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nexo-runner-race-')),scripts=join(dir,'scripts'),state=join(dir,'state');mkdirSync(scripts);mkdirSync(state);
 copyFileSync(source,join(scripts,'run-production-backup.sh'));
 writeFileSync(join(scripts,'backup-db.sh'),`#!/usr/bin/env bash\nprintf 'call\\n' >> "$QA_CALLS"\nif [[ "\${QA_HOLD:-}" == yes ]]; then\n touch "$QA_READY"\n until [[ -f "$QA_RELEASE" ]]; do sleep 0.02; done\nfi\nprintf 'timestamp=x event=backup_created status=success artifact=/synthetic/nexogestao_backup_qa.sql.gz\\n'\n`,{mode:0o700});
 const firstEnv=join(dir,'first.env'),secondEnv=join(dir,'second.env');
 writeFileSync(firstEnv,`BACKUP_MODE=local\nBACKUP_STATE_DIR=${state}\n`);writeFileSync(secondEnv,`BACKUP_MODE=${mode}\nBACKUP_STATE_DIR=${state}\n`);
 const env={...process.env,QA_CALLS:join(dir,'calls'),QA_READY:join(dir,'ready'),QA_RELEASE:join(dir,'release')};
 const first=spawn('bash',[join(scripts,'run-production-backup.sh')],{env:{...env,QA_HOLD:'yes',NEXO_BACKUP_ENV_FILE:firstEnv},stdio:'ignore'});const closed=once(first,'close');
 try{
  const deadline=Date.now()+5000;while(!existsSync(env.QA_READY)){if(Date.now()>deadline)throw new Error('first runner did not enter engine');await delay(20);}
  const second=spawnSync('bash',[join(scripts,'run-production-backup.sh')],{env:{...env,NEXO_BACKUP_ENV_FILE:secondEnv},encoding:'utf8',timeout:5000});
  assert.equal(second.status,75,second.stderr);assert.match(second.stderr,/LOCKED/);
  assert.equal(readFileSync(env.QA_CALLS,'utf8'),'call\n');assert(!existsSync(join(state,'last-attempt.json')));
 }finally{
  writeFileSync(env.QA_RELEASE,'release');const [code]=await closed;
  try{assert.equal(code,0);const attempt=readFileSync(join(state,'last-attempt.json'),'utf8');assert.equal(attempt,readFileSync(join(state,'last-success.json'),'utf8'));assert(!existsSync(join(state,'.backup-runner.lock')));}finally{rmSync(dir,{recursive:true,force:true});}
 }
});
