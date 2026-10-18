import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const spec=JSON.parse(readFileSync(join(root,'qa','features.json'),'utf8'));
const path=join(root,'data',`qa-live-results-${spec.release}.json`);
let saved={};if(existsSync(path))try{saved=JSON.parse(readFileSync(path,'utf8'));}catch{}
const rl=createInterface({input:process.stdin,output:process.stdout});
console.log(`WA-WORLD v${spec.release} — CATAT HASIL UJI WHATSAPP NYATA (tidak mengirim pesan otomatis)`);
console.log('P=berhasil, F=gagal, S=lewati/belum diuji. Utamakan tiga tes WAJIB.');
try{
 for(const c of spec.checks.filter(x=>x.method==='LIVE')){
   const a=(await rl.question(`\n[${c.flag}] ${c.id} — ${c.name}\n${c.instructions}\nHasil [P/F/S] (Enter=lewati): `)).trim().toUpperCase();
   if(a==='P'||a==='F')saved[c.id]={status:a==='P'?'PASS':'FAIL',updatedAt:new Date().toISOString(),note:'Reported manually by project operator'};
   else if(a==='S')delete saved[c.id];
 }
 mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(saved,null,2)+'\n');
 console.log(`\nTersimpan di data/qa-live-results-${spec.release}.json. Jalankan QA-ONE-CLICK.bat agar dashboard diperbarui.`);
}finally{rl.close();}
