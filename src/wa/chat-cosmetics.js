/** WOW v3.2 account-bound cosmetics presets. Never handles real money or message contents. */
const VALID=/^[a-z][a-z0-9-]{0,15}$/;
const SLOTS=['badge','frame','title'];
export function createChatCosmetics(db){
 db.exec(`CREATE TABLE IF NOT EXISTS wow_chat_presets (
   user_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,
   badge TEXT,frame TEXT,title TEXT,created_ms INTEGER NOT NULL,
   PRIMARY KEY(user_id,name));
 CREATE TABLE IF NOT EXISTS wow_chat_preset_active (
   user_id TEXT PRIMARY KEY REFERENCES users(id),name TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_wow_chat_presets_user ON wow_chat_presets(user_id);`);
 function owned(id,item){return !item||!!db.prepare('SELECT 1 FROM item_stacks WHERE user_id=? AND item_id=? AND quantity>0').get(id,item);}
 function equip(id){return Object.fromEntries(db.prepare('SELECT slot,item_id FROM item_equipment WHERE user_id=?').all(id).map(x=>[x.slot,x.item_id]));}
 function list(id){return db.prepare('SELECT name FROM wow_chat_presets WHERE user_id=? ORDER BY name').all(id).map(x=>x.name);}
 function selected(id){return db.prepare('SELECT name FROM wow_chat_preset_active WHERE user_id=?').get(id)?.name??null;}
 function resolved(id){
  const active=selected(id);if(!active)return equip(id);
  const saved=db.prepare('SELECT badge,frame,title FROM wow_chat_presets WHERE user_id=? AND name=?').get(id,active);
  if(!saved)return equip(id);
  return Object.fromEntries(SLOTS.map(slot=>[slot,owned(id,saved[slot])?saved[slot]:null]));
 }
 function execute(id,words,at){
  const op=words[0]?.toLowerCase(),name=words[1]?.toLowerCase();
  if(op==='list'||!op)return `🎨 PRESET WOW (${list(id).length}/5)\n${list(id).join(', ')||'(belum ada)'}\nAktif: ${selected(id)??'equipment langsung'}\n.chatstyle preset save NAMA | use NAMA | remove NAMA | off`;
  if(op==='off'){db.prepare('DELETE FROM wow_chat_preset_active WHERE user_id=?').run(id);return '✅ Preset OFF. Menggunakan equipment yang sedang dipakai.';}
  if(!VALID.test(name??''))return 'Nama preset: huruf kecil/angka/- maksimal 16 karakter, diawali huruf.';
  if(op==='save'){
   if(!db.prepare('SELECT 1 FROM wow_chat_presets WHERE user_id=? AND name=?').get(id,name)&&list(id).length>=5)return 'Maksimal 5 preset.';
   const e=equip(id);
   db.prepare(`INSERT INTO wow_chat_presets(user_id,name,badge,frame,title,created_ms) VALUES(?,?,?,?,?,?)
    ON CONFLICT(user_id,name) DO UPDATE SET badge=excluded.badge,frame=excluded.frame,title=excluded.title,created_ms=excluded.created_ms`).run(id,name,e.badge??null,e.frame??null,e.title??null,at);
   return `✅ Preset ${name} disimpan dari equipment saat ini. Gunakan .chatstyle preset use ${name}`;
  }
  if(op==='use'){
   if(!db.prepare('SELECT 1 FROM wow_chat_presets WHERE user_id=? AND name=?').get(id,name))return 'Preset tidak ditemukan.';
   db.prepare('INSERT INTO wow_chat_preset_active(user_id,name) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name').run(id,name);
   return `✅ Preset ${name} aktif (item yang sudah tidak dimiliki otomatis disembunyikan).`;
  }
  if(op==='remove'){
   const n=db.prepare('DELETE FROM wow_chat_presets WHERE user_id=? AND name=?').run(id,name).changes;
   db.prepare('DELETE FROM wow_chat_preset_active WHERE user_id=? AND name=?').run(id,name);
   return n?`✅ Preset ${name} dihapus.`:'Preset tidak ditemukan.';
  }
  return 'Gunakan .chatstyle preset list|save|use|remove|off.';
 }
 return {execute,resolved,list,selected};
}
