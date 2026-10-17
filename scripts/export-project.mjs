#!/usr/bin/env node
/** No-GitHub handoff: export non-secret source/tracker as a ZIP upload for the next release. */
import {readdirSync, readFileSync, mkdirSync, writeFileSync, lstatSync} from 'node:fs';
import {resolve, relative, join, sep} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
const maxEntry=8*1024*1024, maxTotal=100*1024*1024;
const blockedDirs=new Set(['node_modules','data','.git','.wa-world','exports','updates','.vscode','.idea','auth','wa-auth','sessions','.sessions','secrets','private','credentials']);
const hiddenSecrets=/^(\.env(?:\..*)?|\.npmrc|\.pypirc|\.netrc|creds\.json|credentials\.json|id_rsa|id_ed25519)$/i;
const forbiddenSuffix=/\.(pem|key|p12|pfx|sqlite|db|sqlite-wal|sqlite-shm)$/i;
const hash=buf=>createHash('sha256').update(buf).digest('hex');
const crcTable=Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const v of bytes)crc=crcTable[(crc^v)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function u16(n){const b=Buffer.alloc(2);b.writeUInt16LE(n);return b;}
function u32(n){const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;}
const collected=[];let total=0;
function walk(dir){
 for(const dirent of readdirSync(dir,{withFileTypes:true})){
  const filename=dirent.name; const path=join(dir,filename); const rel=relative(root,path).replaceAll(sep,'/');
  if(dirent.isSymbolicLink())continue;
  if(dirent.isDirectory()){if(!blockedDirs.has(filename))walk(path);continue;}
  if(!dirent.isFile() || hiddenSecrets.test(filename) || forbiddenSuffix.test(filename) || filename.toLowerCase().includes('secret'))continue;
  const stat=lstatSync(path);if(stat.size>maxEntry)throw Error(`File too large, review it: ${rel}`);
  const data=readFileSync(path);total+=data.length;
  if(total>maxTotal)throw Error('Export exceeds 100MB, review project files');
  collected.push({name:`WA-WORLD-Starter/${rel}`,data,sha256:hash(data)});
 }
}
function makeZip(entries){
 let offset=0;const local=[],central=[];
 for(const e of entries){
  const name=Buffer.from(e.name,'utf8'),data=e.data,crc=crc32(data);
  const lh=Buffer.concat([u32(0x04034b50),u16(20),u16(0x800),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);
  local.push(lh);
  central.push(Buffer.concat([u32(0x02014b50),u16(0x031e),u16(20),u16(0x800),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]));
  offset+=lh.length;
 }
 const cd=Buffer.concat(central), end=Buffer.concat([u32(0x06054b50),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(cd.length),u32(offset),u16(0)]);
 return Buffer.concat([...local,cd,end]);
}
try{
 walk(root);collected.sort((a,b)=>a.name.localeCompare(b.name));
 const version=JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version;
 const manifest={project:'WA-WORLD Ultimate',session:'GPT-6A29EB-20261016-B20C6A4DA9',version,warning:'Review archive before sharing. It excludes known secret/data locations, but cannot identify secrets manually typed into source files.',files:collected.map(({name,sha256})=>({path:name,sha256}))};
 collected.push({name:'EXPORT-MANIFEST.json',data:Buffer.from(JSON.stringify(manifest,null,2)+'\n')});
 const outDir=join(root,'exports');mkdirSync(outDir,{recursive:true});
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const out=join(outDir,`WA-WORLD-SOURCE-v${version}-${stamp}.zip`);
 writeFileSync(out,makeZip(collected),{flag:'wx'});
 console.log(`Export created: ${out}\n${manifest.files.length} files, no data/, no auth/, no .env, no node_modules/.`);
 console.log('IMPORTANT: Inspect ZIP content before uploading; custom code/docs can still contain secrets.');
}catch(e){console.error('EXPORT ERROR: '+e.message);process.exitCode=1;}
