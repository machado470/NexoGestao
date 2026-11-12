import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const engine=fileURLToPath(new URL('./backup-db.sh',import.meta.url));
function fixture(run){const dir=mkdtempSync(join(tmpdir(),'nexo-backup-source-')),bin=join(dir,'bin'),artifacts=join(dir,'artifacts'),calls=join(dir,'calls');mkdirSync(bin);
 writeFileSync(join(bin,'docker'),`#!/usr/bin/env bash\ncase "$1" in\ninspect) printf '%s\\n' "\${QA_RUNNING:-true}";;\nexec) printf 'container\\n' >> "$QA_CALLS"; printf 'SELECT 2;\\n';;\n*) exit 1;;\nesac\n`,{mode:0o700});
 writeFileSync(join(bin,'pg_dump'),`#!/usr/bin/env bash\n[[ -z "\${PGHOSTADDR:-}\${PGSERVICE:-}\${PGSERVICEFILE:-}" ]] || exit 88\nprintf 'host\\n' >> "$QA_CALLS"\nprintf 'SELECT 1;\\n'\n`,{mode:0o700});
 const check=(overrides={},args=[])=>spawnSync('bash',[engine,...args],{encoding:'utf8',env:{...process.env,PATH:bin+':'+process.env.PATH,DB_CONTAINER:'',BACKUP_DIR:artifacts,POSTGRES_USER:'qa',POSTGRES_DB:'qa',POSTGRES_HOST:'127.0.0.1',POSTGRES_PORT:'55490',QA_CALLS:calls,...overrides},timeout:5000});
 try{run({check,calls,artifacts,called:()=>existsSync(calls)});}finally{rmSync(dir,{recursive:true,force:true});}}
test('host configuration does not auto-select a default container',()=>fixture(({check,calls})=>{const r=check();assert.equal(r.status,0,r.stderr);assert.equal(readFileSync(calls,'utf8'),'host\n');}));
test('explicit running container is used',()=>fixture(({check,calls,artifacts})=>{const r=check({DB_CONTAINER:'synthetic-container'});assert.equal(r.status,0,r.stderr);assert.equal(readFileSync(calls,'utf8'),'container\n');const file=readdirSync(artifacts).find(x=>x.endsWith('.sql.gz'));assert.equal(spawnSync('gzip',['-cd',join(artifacts,file)],{encoding:'utf8'}).stdout,'SELECT 2;\n');}));
test('stopped explicit container cannot fall back to host',()=>fixture(({check,called})=>{assert.notEqual(check({DB_CONTAINER:'synthetic-container',QA_RUNNING:'false'}).status,0);assert(!called());}));
test('missing source cannot auto-select a container',()=>fixture(({check,called})=>{assert.notEqual(check({POSTGRES_HOST:''}).status,0);assert(!called());}));
test('ambient libpq routing does not override host source',()=>fixture(({check,calls})=>{const r=check({PGHOSTADDR:'203.0.113.1',PGSERVICE:'synthetic-remote',PGSERVICEFILE:'/nonexistent/synthetic'});assert.equal(r.status,0,r.stderr);assert.equal(readFileSync(calls,'utf8'),'host\n');}));

test('empty container CLI selection cannot fall back to host',()=>fixture(({check,called})=>{assert.notEqual(check({},['--container','']).status,0);assert(!called());}));
