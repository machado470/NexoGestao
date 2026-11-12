import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script=fileURLToPath(new URL('./restore-db.sh',import.meta.url));
function fixture(run){
 const dir=mkdtempSync(join(tmpdir(),'nexo-restore-checksum-')),bin=join(dir,'bin');mkdirSync(bin);
 const name='nexogestao_backup_synthetic.sql.gz',file=join(dir,name),calls=join(dir,'calls');
 writeFileSync(file,spawnSync('gzip',['-c'],{input:'SELECT 1;\n'}).stdout);
 const hash=createHash('sha256').update(readFileSync(file)).digest('hex');
 for(const [cmd,body] of Object.entries({psql:'printf "called\\n" >> "$RESTORE_TEST_CALLS"\ncat >/dev/null\nprintf "1\\n"',pnpm:'exit 0'}))writeFileSync(join(bin,cmd),'#!/usr/bin/env bash\n'+body+'\n',{mode:0o700});
 const sidecar=text=>writeFileSync(file+'.sha256',text);
 const check=()=>spawnSync('bash',[script,'--non-interactive',file],{encoding:'utf8',env:{...process.env,PATH:bin+':'+process.env.PATH,DATABASE_URL:'postgresql://qa:qa@127.0.0.1:55490/restore_test',DB_CONTAINER:'',NODE_ENV:'test',ALLOW_NON_PRODUCTION_RESTORE:'yes',RESTORE_TEST_CALLS:calls}});
 try{run({dir,name,file,hash,sidecar,check,called:()=>existsSync(calls)});}finally{rmSync(dir,{recursive:true,force:true});}
}
test('valid canonical sidecar reaches simulated restore and migration',()=>fixture(({hash,name,sidecar,check,called})=>{sidecar(`${hash}  ${name}\n`);const r=check();assert.equal(r.status,0,r.stderr);assert(called());}));
test('a checksum for another valid file cannot authorize restoring the requested dump',()=>fixture(({dir,sidecar,check,called})=>{writeFileSync(join(dir,'decoy.txt'),'decoy');const hash=createHash('sha256').update('decoy').digest('hex');sidecar(`${hash}  decoy.txt\n`);assert.notEqual(check().status,0);assert(!called());}));
test('mismatched hash never invokes database commands',()=>fixture(({name,sidecar,check,called})=>{sidecar(`${'0'.repeat(64)}  ${name}\n`);assert.notEqual(check().status,0);assert(!called());}));
test('multiple checksum entries are rejected',()=>fixture(({name,hash,sidecar,check,called})=>{sidecar(`${hash}  ${name}\n${hash}  ${name}\n`);assert.notEqual(check().status,0);assert(!called());}));
test('missing and malformed sidecars never invoke database commands',()=>fixture(({sidecar,check,called})=>{assert.notEqual(check().status,0);sidecar('not a checksum\n');assert.notEqual(check().status,0);assert(!called());}));
