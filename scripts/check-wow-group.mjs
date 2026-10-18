// WOW v3.0.0 read-only group diagnostics. Does NOT write to .env or SQLite.
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const envPath=resolve('.env');
console.log('==========================================================');
console.log('  WOW v3.0.0 — CHECK GROUP, ADMIN & CHAT DECORATION');
console.log('==========================================================');
const pkg=JSON.parse(readFileSync(resolve('package.json'),'utf8'));
console.log('Source project  :', pkg.version);
console.log('Node.js         :', process.version);
if(!existsSync(envPath)) {
  console.log('File .env       : TIDAK ADA. Buat dari .env.example.');
} else {
  try {process.loadEnvFile(envPath); console.log('File .env       : ADA, berhasil dibaca');}
  catch(e) {console.log('File .env       : ERROR:',e.message);}
}
const enabled=process.env.WA_ENABLE_GROUPS==='true';
console.log('WA_ENABLE_GROUPS:',enabled?'ON':'OFF (harus persis true)');
const allowed=(process.env.WA_ALLOWED_JIDS??'').split(',').map(x=>x.trim()).filter(Boolean);
console.log('WA_ALLOWED_JIDS:',allowed.length ? `${allowed.length} entri — pastikan ID admin DM dan JID grup termasuk` : 'kosong — tidak memfilter pesan');
const admins=(process.env.WOW_ADMIN_IDS??'').split(',').map(x=>x.trim()).filter(Boolean);
console.log('WOW_ADMIN_IDS   :',admins.length ? `${admins.length} akun terdaftar (nilai dirahasiakan)` : 'KOSONG — jalankan SETUP-WOW-ADMIN.bat');
const dbPath=resolve(process.env.WA_DB_PATH??'./data/world.sqlite');
console.log('Database       :',existsSync(dbPath)?'ditemukan':'belum ditemukan / path tidak sesuai');
if(existsSync(dbPath)) {
  let db;
  try {
    db=new DatabaseSync(dbPath,{readOnly:true});
    const global=db.prepare('SELECT enabled FROM wow_chat_global WHERE singleton=1').get();
    const groups=db.prepare('SELECT COUNT(*) AS n FROM wow_chat_groups WHERE enabled=1').get();
    const mirror=db.prepare("SELECT COUNT(*) AS n FROM wow_chat_groups WHERE enabled=1 AND mode='mirror'").get();
    const consenting=db.prepare('SELECT COUNT(*) AS n FROM wow_chat_users WHERE consent=1').get();
    console.log('Chat global DB  :',global?.enabled?'ON':'OFF');
    console.log('Grup aktif DB  :',groups?.n??0,'(Mirror:',mirror?.n??0,')');
    console.log('Pemain opt-in  :',consenting?.n??0);
  }catch(e){console.log('Chat policy DB : belum terinisialisasi atau gagal dibaca (',e.message,')');}
  finally{try{db?.close();}catch{/* read-only */}}
}
console.log('\nPERINTAH SETUP:');
console.log('1. DM bot        : .whoami');
console.log('2. PC server     : SETUP-WOW-ADMIN.bat (ID hasil .whoami)');
console.log('3. Restart bot   : WA-START.bat; pastikan log groups=on');
console.log('4. DM Admin WOW  : .admin show / .admin chat global on');
console.log('5. Di grup admin : .wowchat enable / .wowchat mode mirror');
console.log('6. DM pemain     : .chatstyle on / .chatstyle preview');
console.log('7. Grup          : kirim teks biasa <=280 karakter, bukan command');
console.log('CATATAN: Tahap 1 tidak menghapus pesan asli dan bukan auto-reply untuk setiap command grup.');
console.log('Jika .wowchat dibalas akses ditolak, pastikan admin grup WA dan ID @lid sesuai metadata.');
