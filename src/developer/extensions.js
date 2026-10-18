/** Declarative, non-executable extensions. No JavaScript plugins are loaded. */
import { readdirSync,readFileSync,existsSync,lstatSync } from 'node:fs';
import { resolve,join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const defaultDir=resolve(dirname(fileURLToPath(import.meta.url)),'..','..','extensions');
const idRe=/^[a-z][a-z0-9-]{2,30}$/;
const cmdRe=/^[a-z][a-z0-9-]{2,30}$/;
export function validateExtension(x) {
  if(!x || typeof x!=='object' || Array.isArray(x))throw Error('Extension must be object');
  const fields=Object.keys(x);
  if(fields.some(k=>!['id','name','description','enabled','commands'].includes(k)))throw Error('Unsupported manifest field');
  if(!idRe.test(x.id ?? '') || typeof x.name!=='string' || x.name.length>50 || !x.name.trim())throw Error('Invalid extension identity');
  if(typeof x.enabled!=='boolean'||!Array.isArray(x.commands)||x.commands.length>8||x.commands.length<1)throw Error('Invalid extension commands');
  if(typeof x.description!=='string'||x.description.length>180)throw Error('Invalid description');
  const seen=new Set();
  for(const c of x.commands){
    if(!c||typeof c!=='object'||Object.keys(c).some(k=>!['command','response'].includes(k)))throw Error('Unsupported command definition');
    if(!cmdRe.test(c.command??'')||seen.has(c.command))throw Error('Duplicate/invalid command');
    if(typeof c.response!=='string'||!c.response.trim()||c.response.length>650||/[\u0000-\u0008]/.test(c.response))throw Error('Invalid response');
    seen.add(c.command);
  }
  return x;
}
export function readExtensions(folder=defaultDir){
  if(!existsSync(folder))return [];
  const names=readdirSync(folder).filter(n=>n.endsWith('.json'));
  if(names.length>30)throw Error('Extension limit exceeded');
  const seenIds=new Set(),seenCommands=new Set();
  return names.sort().map(name=>{
    if(!/^[a-z0-9-]+\.json$/.test(name))throw Error('Invalid extension filename');
    const p=join(folder,name);
    if(lstatSync(p).isSymbolicLink())throw Error('Extension symlinks not allowed');
    const content=readFileSync(p);
    if(content.byteLength>10000)throw Error('Extension too large');
    const e=validateExtension(JSON.parse(content.toString('utf8')));
    if(name!==`${e.id}.json` ||seenIds.has(e.id))throw Error('Duplicate/invalid filename');
    seenIds.add(e.id);
    for(const c of e.commands){
      const full=`${e.id}:${c.command}`;
      if(seenCommands.has(full))throw Error('Duplicate command');
      seenCommands.add(full);
    }
    return e;
  });
}
export function runExtension(text,folder=defaultDir){
  const m=/^\.ext\s+([a-z][a-z0-9-]{2,30})\s+([a-z][a-z0-9-]{2,30})\s*$/i.exec(text.trim());
  if(!/^\.ext(?:\s|$)/i.test(text.trim()))return null;
  if(!m)return 'Gunakan .ext list atau .ext ID COMMAND';
  const e=readExtensions(folder).find(e=>e.enabled&&e.id===m[1].toLowerCase());
  if(!e)return 'Ekstensi tidak ditemukan atau nonaktif. Ketik .ext list';
  return e.commands.find(c=>c.command===m[2].toLowerCase())?.response??'Command ekstensi tidak ditemukan.';
}
export function extensionList(folder=defaultDir){
  return readExtensions(folder).map(({id,name,description,enabled,commands})=>({id,name,description,enabled,commands:commands.map(c=>c.command)}));
}
export function handleExtension(text,folder=defaultDir){
  if(!/^\.ext(?:\s|$)/i.test(text.trim()))return null;
  if(/^\.ext\s+list\s*$/i.test(text.trim())){
    const extensions=extensionList(folder).filter(e=>e.enabled);
    return extensions.length?'🧩 Ekstensi WA-WORLD\n'+extensions.map(e=>`${e.name}: ${e.commands.map(c=>`.ext ${e.id} ${c}`).join(', ')}`).join('\n'):'Belum ada ekstensi aktif.';
  }
  return runExtension(text,folder);
}
