import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
let maxAge, requireOffsite = false;
const usage = () => { console.error('Usage: backup-status.sh --check --max-age-seconds <positive integer> [--require-offsite]'); process.exit(64); };
while (args.length) {
  const arg = args.shift();
  if (arg === '--max-age-seconds' && maxAge === undefined) {
    const raw = args.shift();
    if (!raw || !/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(Number(raw))) usage();
    maxAge = Number(raw);
  } else if (arg === '--require-offsite' && !requireOffsite) requireOffsite = true;
  else usage();
}
if (!maxAge || !process.env.BACKUP_STATE_DIR) usage();
const now = Date.now();
function result(reasonCode, ageSeconds = null) {
  const passed = reasonCode === 'BACKUP_CHECK_PASSED';
  console.log(JSON.stringify({ schemaVersion: 1, checkedAt: new Date(now).toISOString(), passed, reasonCode, maxAgeSeconds: maxAge, requireOffsite, ageSeconds }));
  process.exitCode = passed ? 0 : 1;
}
function readState(name) {
  const state = JSON.parse(readFileSync(join(process.env.BACKUP_STATE_DIR, name), 'utf8'));
  if (!state || state.schemaVersion !== 1 || !['success', 'failure'].includes(state.result)
    || !Number.isInteger(state.exitCode) || (state.result === 'success' && (state.exitCode !== 0 || state.localBackup !== 'created'))
    || typeof state.startedAt !== 'string' || typeof state.finishedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(state.startedAt)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(state.finishedAt)
    || !Number.isFinite(Date.parse(state.startedAt)) || !Number.isFinite(Date.parse(state.finishedAt))
    || Date.parse(state.startedAt) > Date.parse(state.finishedAt) || Date.parse(state.finishedAt) > now) throw new Error('Invalid state');
  return state;
}
let attempt, success;
try { attempt = readState('last-attempt.json'); }
catch { result('BACKUP_ATTEMPT_UNAVAILABLE'); }
if (attempt) {
  if (attempt.result !== 'success') result('BACKUP_LAST_ATTEMPT_FAILED');
  else {
    try { success = readState('last-success.json'); }
    catch { result('BACKUP_SUCCESS_UNAVAILABLE'); }
    if (success) {
      const age = Math.floor((now - Date.parse(success.finishedAt)) / 1000);
      if (success.result !== 'success' || ['startedAt', 'finishedAt', 'exitCode', 'localBackup', 'offsiteUpload', 'artifactName', 'reasonCode'].some(key => success[key] !== attempt[key])) result('BACKUP_STATE_INCONSISTENT');
      else if (now - Date.parse(success.finishedAt) > maxAge * 1000) result('BACKUP_STALE', age);
      else if (requireOffsite && success.offsiteUpload !== 'uploaded') result('BACKUP_OFFSITE_UNCONFIRMED', age);
      else result('BACKUP_CHECK_PASSED', age);
    }
  }
}
