import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const source=fileURLToPath(new URL('./run-production-backup.sh',import.meta.url));
const realTee=spawnSync('bash',['-c','command -v tee'],{encoding:'utf8'}).stdout.trim();
for(const mode of ['success','offsite-failure','tee-failure'])test('captures completed output before state publication: '+mode,()=>{
 const dir=mkdtempSync(join(tmpdir(),'nexo-backup-output-')),scripts=join(dir,'scripts'),bin=join(dir,'bin'),state=join(dir,'state');mkdirSync(scripts);mkdirSync(bin);
 try{
  copyFileSync(source,join(scripts,'run-production-backup.sh'));
  writeFileSync(join(scripts,'backup-db.sh'),`#!/usr/bin/env bash\nprintf 'timestamp=x event=backup_created status=success artifact=/synthetic/nexogestao_backup_output.sql.gz\\n'\nif [[ "$QA_MODE" == offsite-failure ]]; then printf 'event=offsite_failed result=OFFSITE_UPLOAD_FAILED\\n' >&2; exit 23; fi\n`,{mode:0o700});
  writeFileSync(join(bin,'tee'),`#!/usr/bin/env bash\nif [[ "$QA_MODE" == tee-failure ]]; then cat >/dev/null; exit 7; fi\nsleep 0.2\nexec "$QA_REAL_TEE" "$@"\n`,{mode:0o700});
  writeFileSync(join(bin,'aws'),'#!/usr/bin/env bash\nexit 0\n',{mode:0o700});
  const config=join(dir,'backup.env');writeFileSync(config,`BACKUP_MODE=${mode==='offsite-failure'?'local_and_offsite':'local'}\nBACKUP_STATE_DIR=${state}\nBACKUP_S3_BUCKET=synthetic-unused\n`);
  const result=spawnSync('bash',[join(scripts,'run-production-backup.sh')],{env:{...process.env,PATH:bin+':'+process.env.PATH,NEXO_BACKUP_ENV_FILE:config,QA_MODE:mode,QA_REAL_TEE:realTee},encoding:'utf8',timeout:5000});
  const snapshot=JSON.parse(readFileSync(join(state,'last-attempt.json'),'utf8'));
  if(mode==='tee-failure'){assert.notEqual(result.status,0);assert.equal(snapshot.result,'failure');}
  else{
   assert.equal(snapshot.artifactName,'nexogestao_backup_output.sql.gz');
   if(mode==='success'){assert.equal(result.status,0);assert.equal(snapshot.result,'success');}
   else{assert.equal(result.status,23);assert.equal(snapshot.reasonCode,'OFFSITE_UPLOAD_FAILED');assert.equal(snapshot.localBackup,'created');}
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
