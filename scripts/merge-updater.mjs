#!/usr/bin/env node
/** WA-WORLD offline patch installer v1: dependency-free; never runs code from patch. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, lstatSync, openSync, closeSync, renameSync, rmSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, join, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

const SELF = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT = resolve(SELF, '..');
const HEX = /^[a-f0-9]{64}$/;
const REQUIRED_PREFIX = 'payload/';
const sha = b => createHash('sha256').update(b).digest('hex');
const fail = m => { throw Error(m); };
const log = m => process.stdout.write(m + '\n');
const readJson = p => JSON.parse(readFileSync(p, 'utf8'));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function pathCheck(p) {
  if (typeof p !== 'string' || !p || p.length > 240 || p.includes('\\') || p.includes('\0') || p.startsWith('/') || isAbsolute(p)) fail(`Unsafe patch path: ${p}`);
  const segments = p.split('/');
  if (segments.some(s => !s || s === '.' || s === '..' || /[<>:"|?*\x00-\x1f]/.test(s) || /[ .]$/.test(s))) fail(`Unsafe segment: ${p}`);
  if (segments[0].toLowerCase() === 'node_modules' || segments[0].toLowerCase() === 'data' || segments[0].toLowerCase() === '.git' || segments[0].toLowerCase() === '.wa-world' || segments[0].toLowerCase() === 'backups' || segments[0].toLowerCase() === 'updates' || segments[0].toLowerCase() === 'exports' || segments[0].toLowerCase() === '.env' || segments.some(s => s.toLowerCase().startsWith('.env'))) fail(`Protected user-data path: ${p}`);
  if (p.toLowerCase().endsWith('.sqlite') || p.toLowerCase().endsWith('.sqlite-wal') || p.toLowerCase().endsWith('.sqlite-shm')) fail(`Protected database: ${p}`);
  return p;
}
function rooted(project, p) {
  pathCheck(p);
  const dst = resolve(project, ...p.split('/'));
  if (!dst.startsWith(project + sep)) fail(`Path escapes project: ${p}`);
  let cur = project;
  if (lstatSync(cur).isSymbolicLink()) fail('Project root cannot be symlink');
  for (const segment of p.split('/')) {
    cur = join(cur, segment);
    if (existsSync(cur) && lstatSync(cur).isSymbolicLink()) fail(`Symlink forbidden: ${cur}`);
  }
  return dst;
}
// Minimal ZIP central-directory reader (store/deflate only). No native tools, no external npm deps.
function zipEntries(filename) {
  const buf = readFileSync(filename);
  if (buf.length > 30_000_000) fail('Patch ZIP too large (>30MB)');
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) fail('Invalid ZIP: end record missing');
  if (buf.readUInt16LE(eocd + 4) || buf.readUInt16LE(eocd + 6)) fail('Multipart ZIP not supported');
  const count = buf.readUInt16LE(eocd + 10);
  const offset = buf.readUInt32LE(eocd + 16);
  const size = buf.readUInt32LE(eocd + 12);
  if (count > 500 || offset + size > eocd) fail('Invalid ZIP index');
  const entries = new Map();
  let ptr = offset; let total = 0;
  for (let i = 0; i < count; i++) {
    if (ptr + 46 > buf.length || buf.readUInt32LE(ptr) !== 0x02014b50) fail('Invalid ZIP central directory');
    const flag = buf.readUInt16LE(ptr + 8), method = buf.readUInt16LE(ptr + 10);
    const compressed = buf.readUInt32LE(ptr + 20), plain = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28), extraLen = buf.readUInt16LE(ptr + 30), commentLen = buf.readUInt16LE(ptr + 32);
    const external = buf.readUInt32LE(ptr + 38), localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.subarray(ptr + 46, ptr + 46 + nameLen).toString('utf8');
    ptr += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    if (!name || name.includes('\\') || name.startsWith('/') || name.split('/').some(x => x === '..' || x === '.')) fail('Unsafe ZIP name');
    if (entries.has(name)) fail('Duplicate ZIP name: ' + name);
    if (flag & 1 || ![0,8].includes(method)) fail('Encrypted or unsupported ZIP compression');
    if (((external >>> 16) & 0o170000) === 0o120000) fail('ZIP contains symlink');
    if (plain > 3_000_000 || (total += plain) > 15_000_000) fail('ZIP extraction size limit exceeded');
    if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== 0x04034b50) fail('Invalid ZIP local file header');
    const localFlags = buf.readUInt16LE(localOffset + 6);
    const localMethod = buf.readUInt16LE(localOffset + 8);
    if (localFlags !== flag || localMethod !== method) fail('ZIP header mismatch');
    const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    if (start + compressed > buf.length) fail('Truncated ZIP member');
    const member = buf.subarray(start, start + compressed);
    const contents = method === 0 ? member : inflateRawSync(member, { maxOutputLength: 3_000_001 });
    if (contents.length !== plain) fail('ZIP declared size mismatch');
    entries.set(name, contents);
  }
  if (ptr !== offset + size) fail('Invalid central directory size');
  return entries;
}
function mergeTracker(old, incoming) {
  if (!old || !incoming || !Array.isArray(old.tasks) || !Array.isArray(incoming.tasks)) fail('Tracker JSON invalid');
  const oldTasks = new Map(old.tasks.map(t => [t.id,t]));
  const oldMilestones = new Map(old.milestones.map(m => [m.id,m]));
  if (oldTasks.size !== old.tasks.length || oldMilestones.size !== old.milestones.length) fail('Duplicate existing tracker IDs');
  const addedTasks = incoming.tasks.filter(t => !oldTasks.has(t.id));
  const addedMiles = incoming.milestones.filter(m => !oldMilestones.has(m.id));
  // Keep current progress for ALL existing entries; only add missing canonical entries.
  return {
    ...old,
    project: old.project,
    session: old.session,
    version: incoming.version,
    phase: incoming.phase,
    last_updated: incoming.last_updated,
    milestones: [...old.milestones, ...addedMiles],
    tasks: [...old.tasks, ...addedTasks],
    status_values: old.status_values || incoming.status_values,
    notes: incoming.notes
  };
}
function parsePatch(zipPath) {
  const entries = zipEntries(zipPath);
  if (!entries.has('patch.json')) fail('Missing patch.json');
  const manifest = JSON.parse(entries.get('patch.json').toString('utf8'));
  if (manifest.format !== 1 || manifest.project_id !== 'wa-world' || !Array.isArray(manifest.from_versions) || typeof manifest.to_version !== 'string' || !Array.isArray(manifest.files)) fail('Unrecognized WA-WORLD patch format');
  if (!/^\d+\.\d+\.\d+$/.test(manifest.to_version)) fail('Invalid target version');
  if (manifest.files.length > 400) fail('Too many patch file operations');
  const seen = new Set();
  for (const f of manifest.files) {
    pathCheck(f.path);
    const key = f.path.toLowerCase();
    if (seen.has(key)) fail('Duplicate path in manifest'); seen.add(key);
    if (!['add','replace','merge-tracker'].includes(f.action) || !HEX.test(f.sha256)) fail('Invalid patch operation');
    if (f.action === 'replace' && !HEX.test(f.base_sha256)) fail('Replace needs base SHA-256');
    if (f.action === 'merge-tracker' && f.path !== 'project/tracker.json') fail('Merge allowed only for tracker');
    const payload = entries.get(REQUIRED_PREFIX+f.path);
    if (!payload || sha(payload) !== f.sha256) fail(`Payload missing / damaged: ${f.path}`);
  }
  const allowed = new Set(['patch.json', ...manifest.files.map(f => REQUIRED_PREFIX + f.path)]);
  for (const name of entries.keys()) if (!allowed.has(name)) fail(`Unexpected ZIP member: ${name}`);
  return { manifest, entries };
}
function projectInfo(project) {
  if (!existsSync(project)) fail(`Project not found: ${project}`);
  const pkg = readJson(join(project, 'package.json'));
  const tracker = readJson(join(project, 'project', 'tracker.json'));
  if (pkg.name !== 'wa-world-starter' || tracker.project !== 'WA-WORLD Ultimate') fail('This is not a supported WA-WORLD project');
  if (pkg.version !== tracker.version) fail(`Version mismatch: package ${pkg.version}, tracker ${tracker.version}`);
  return { pkg, tracker, version: pkg.version };
}
function plan(project, patch) {
  const info = projectInfo(project);
  const { manifest, entries } = patch;
  if (info.version === manifest.to_version) return { info, operations: [], already: true };
  if (!manifest.from_versions.includes(info.version)) fail(`Incompatible version ${info.version}; patch expects ${manifest.from_versions.join(' / ')}. Do not force.`);
  const operations = [];
  const conflicts = [];
  for (const f of manifest.files) {
    const dst = rooted(project, f.path);
    const previous = existsSync(dst) ? readFileSync(dst) : null;
    const original = previous ? sha(previous) : null;
    let next = entries.get(REQUIRED_PREFIX + f.path);
    let decision = 'write';
    if (f.action === 'add' && previous) {
      if (original === f.sha256) decision = 'skip';
      else conflicts.push(`${f.path}: new file already exists with different contents`);
    } else if (f.action === 'replace') {
      if (!previous) conflicts.push(`${f.path}: source file is missing`);
      else if (original === f.sha256) decision = 'skip';
      else if (original !== f.base_sha256) conflicts.push(`${f.path}: locally modified; refusing to overwrite`);
    } else if (f.action === 'merge-tracker') {
      if (!previous) conflicts.push(`${f.path}: tracker missing`);
      else {
        const merged = mergeTracker(JSON.parse(previous.toString('utf8')), JSON.parse(next.toString('utf8')));
        next = Buffer.from(JSON.stringify(merged,null,2)+'\n');
        if (original === sha(next)) decision = 'skip';
      }
    }
    if (decision !== 'skip') operations.push({ path:f.path, dst, original, newHash:sha(next), previous, next });
  }
  if (conflicts.length) fail('Conflicts found (no files changed):\n - '+conflicts.join('\n - '));
  const targetPkg = operations.find(o => o.path === 'package.json');
  if (!targetPkg && manifest.to_version !== info.version) fail('Patch does not update package.json');
  return { info, operations, already:false };
}
function ensureLock(project) {
  const state = join(project,'.wa-world');
  mkdirSync(state,{recursive:true});
  const lock = join(state,'update.lock');
  const fd = openSync(lock,'wx');
  writeFileSync(fd, `${new Date().toISOString()} pid ${process.pid}\n`);
  return ()=>{ closeSync(fd); rmSync(lock,{force:true}); };
}
function atomicWrite(dst, bytes) {
  mkdirSync(dirname(dst),{recursive:true});
  const tmp = dst+'.wawtemp-'+randomUUID();
  try {writeFileSync(tmp,bytes,{flag:'wx'});renameSync(tmp,dst);} finally { if (existsSync(tmp)) rmSync(tmp,{force:true}); }
}
function historyFile(project) {return join(project,'.wa-world','history.json');}
function getHistory(project){const p=historyFile(project);return existsSync(p) ? readJson(p) : [];}
function storeHistory(project, history){atomicWrite(historyFile(project),Buffer.from(JSON.stringify(history,null,2)+'\n'));}
function apply(project, zipPath) {
  const unlock = ensureLock(project);
  try {
    const patch = parsePatch(zipPath);
    const { info, operations, already } = plan(project,patch);
    if (already) { log(`ALREADY UPDATED: ${info.version}. No changes.`); return; }
    const backupId = new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
    const backDir = join(project,'.wa-world','backups',backupId);
    mkdirSync(backDir,{recursive:true});
    const receipt = {backupId, before:info.version, after:patch.manifest.to_version, installedAt:new Date().toISOString(), files: operations.map(o=>({path:o.path,beforeHash:o.original,afterHash:o.newHash}))};
    // Stage a complete backup before ANY project source change.
    for (const o of operations) if (o.previous !== null) {
      const p=join(backDir,'original', ...o.path.split('/'));
      mkdirSync(dirname(p),{recursive:true});writeFileSync(p,o.previous);
    }
    writeFileSync(join(backDir,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
    let written=[];
    try {
      for (const o of operations) {atomicWrite(o.dst,o.next);written.push(o);}
      storeHistory(project,[...getHistory(project),{ ...receipt,status:'APPLIED' }]);
    } catch(e) {
      for (const o of written.reverse()) {
        if (o.previous === null) rmSync(o.dst,{force:true});
        else atomicWrite(o.dst,o.previous);
      }
      throw Error(`Apply failed, changed files restored: ${e.message}`);
    }
    log(`SUCCESS: ${info.version} -> ${patch.manifest.to_version}; ${operations.length} files updated.`);
    log(`Backup: .wa-world/backups/${backupId}`);
    log('Rollback command: node scripts/merge-updater.mjs rollback');
  } finally {unlock();}
}
function rollback(project) {
  const unlock=ensureLock(project);
  try {
    const history=getHistory(project);
    const current=[...history].reverse().find(h=>h.status==='APPLIED');
    if (!current) fail('No applied updates to rollback');
    if (projectInfo(project).version !== current.after) fail(`Cannot rollback: current project version differs from ${current.after}`);
    const backDir=join(project,'.wa-world','backups',current.backupId);
    const receipt=readJson(join(backDir,'receipt.json'));
    for(const f of receipt.files){
      const dst=rooted(project,f.path);
      if (!existsSync(dst) || sha(readFileSync(dst))!==f.afterHash) fail(`Rollback blocked: ${f.path} changed since update`);
      if (f.beforeHash){
        const original=readFileSync(join(backDir,'original',...f.path.split('/')));
        if(sha(original)!==f.beforeHash) fail(`Damaged backup: ${f.path}`);
      }
    }
    for(const f of receipt.files.slice().reverse()){
      const dst=rooted(project,f.path);
      if(f.beforeHash) atomicWrite(dst,readFileSync(join(backDir,'original',...f.path.split('/'))));
      else rmSync(dst,{force:true});
    }
    const found=history.find(h=>h.backupId===current.backupId);
    found.status='ROLLED_BACK';found.rolledBackAt=new Date().toISOString();
    storeHistory(project,history);
    log(`ROLLBACK COMPLETE: ${receipt.after} -> ${receipt.before}. Existing user data remains untouched.`);
  } finally {unlock();}
}
function cli(){
  const args=process.argv.slice(2);
  const action=args.shift();
  if(!['preview','apply','rollback','history'].includes(action)) fail('Usage: node merge-updater.mjs preview|apply <patch.zip> [--project DIR], rollback|history [--project DIR]');
  const projectIndex=args.indexOf('--project');
  let project=DEFAULT_PROJECT;
  if(projectIndex>=0){ if(!args[projectIndex+1]) fail('--project needs a folder');project=resolve(args[projectIndex+1]); args.splice(projectIndex,2); }
  if(action==='history') { log(JSON.stringify(getHistory(project),null,2));return; }
  if(action==='rollback') {rollback(project);return;}
  const patchArg=args[0]; if(!patchArg) fail('Please provide a patch ZIP file path');
  const patchPath=resolve(patchArg);
  if(!existsSync(patchPath)) fail(`Patch ZIP missing: ${patchPath}`);
  if(action==='apply') return apply(project,patchPath);
  const patch=parsePatch(patchPath), results=plan(project,patch);
  log(`PREVIEW WA-WORLD ${results.info.version} -> ${patch.manifest.to_version}`);
  if(results.already) {log('Already at target version; nothing to apply.');return;}
  for(const o of results.operations) log(`${o.original ? 'REPLACE/MERGE':'ADD    '} ${o.path}`);
  log(`${results.operations.length} file operations. No data or code modified. Backup + rollback available on apply.`);
}
try { cli(); } catch(e){ console.error('\nWA-WORLD UPDATE ERROR: '+e.message); process.exitCode=1; }
