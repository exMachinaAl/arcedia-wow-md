import {createInterface} from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {readFileSync,writeFileSync,existsSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
const envPath=resolve('.env');
const rl=createInterface({input,output});
try{
 console.log('WOW v2.4.1 — setup admin WhatsApp (akses lokal/server saja)');
 console.log('1. Chat bot via DM: .whoami');
 console.log('2. Salin ID lengkap, contohnya 628xxxx@s.whatsapp.net atau xxxx@lid.');
 const answer=(await rl.question('WOW Admin ID/JID (pisahkan koma untuk banyak admin): ')).trim();
 const ids=answer.split(',').map(s=>s.trim()).filter(Boolean);
 if(!ids.length || !ids.every(s=>/^[a-zA-Z0-9._:-]{3,90}@(s\.whatsapp\.net|lid)$/.test(s)))throw Error('ID tidak valid. Pakai hasil .whoami lengkap, tanpa tanda petik.');
 const existing=existsSync(envPath)?readFileSync(envPath,'utf8'):'';
 if(existing && /^(?!#)WOW_ADMIN_IDS\s*=/m.test(existing)){
   const yes=(await rl.question('WOW_ADMIN_IDS sudah ada. Ganti admin terdaftar? (ketik YA): ')).trim();
   if(yes!=='YA'){console.log('Batal. File tidak berubah.');process.exitCode=1;}
   else {const updated=existing.replace(/^(?!#)WOW_ADMIN_IDS\s*=.*$/m,'WOW_ADMIN_IDS='+ids.join(','));save(updated);}
 }else save((existing.endsWith('\n')||existing.length===0?existing:existing+'\n')+'WOW_ADMIN_IDS='+ids.join(',')+'\n');
 function save(content){
  if(existsSync(envPath)){const backup=envPath+'.before-admin-'+Date.now()+'.bak';copyFileSync(envPath,backup);console.log('Backup konfigurasi dibuat:',backup);}
  writeFileSync(envPath,content,'utf8');
  console.log('Admin terdaftar:',ids.length,'ID. Restart WA-START.bat agar daftar admin terbaca.');
  console.log('Di DM: .admin show lalu .admin grant me 500');
 }
}catch(e){console.error('Setup gagal:',e.message);process.exitCode=1;}
finally{rl.close();}
