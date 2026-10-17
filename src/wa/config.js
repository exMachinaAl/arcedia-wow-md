import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
export function loadConfig() {
  // Node >=22.16 includes process.loadEnvFile; local .env is never bundled or updated.
  if(existsSync(resolve('.env')) && typeof process.loadEnvFile==='function') process.loadEnvFile(resolve('.env'));
  const session=resolve(process.env.WA_SESSION_DIR || './data/wa-auth');
  const allowGroups=process.env.WA_ENABLE_GROUPS==='true';
  const allow=(process.env.WA_ALLOWED_JIDS || '').split(',').map(s=>s.trim()).filter(Boolean);
  const allowSender=(sender,jid) => !allow.length || allow.includes(sender) || allow.includes(jid) ||
    allow.some(number => /^[0-9]{8,15}$/.test(number) && (sender.startsWith(number+'@') || jid.startsWith(number+'@')));
  return {session,allowGroups,allowSender,allowCount:allow.length};
}
