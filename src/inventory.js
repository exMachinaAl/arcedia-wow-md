/** WA-WORLD v1.5.0: Server-authoritative, no top-up/no cash-out, zero trading. */
const CATALOG = Object.freeze([
  Object.freeze({id:'focus-token',name:'Focus Token',rarity:'COMMON',kind:'CONSUMABLE',cap:30,description:'Gunakan 1 token untuk +10 XP, maksimal satu penggunaan per hari WIB.'}),
  Object.freeze({id:'hint-scroll',name:'Hint Scroll',rarity:'UNCOMMON',kind:'CONSUMABLE',cap:30,description:'Petunjuk rentang dan paritas saat sesi .guess aktif. Tidak untuk PvP.'}),
  Object.freeze({id:'pioneer-badge',name:'Pioneer Badge',rarity:'LEGENDARY',kind:'EQUIPMENT',slot:'badge',cap:1,description:'Badge edisi awal WA-WORLD. Klaim gratis hingga 31 Desember 2026 WIB.'}),
  Object.freeze({id:'jade-frame',name:'Jade Frame',rarity:'RARE',kind:'EQUIPMENT',slot:'frame',cap:1,description:'Bingkai profil kosmetik, tersedia setelah 10 game dimainkan.'}),
  Object.freeze({id:'veteran-title',name:'Veteran Title',rarity:'EPIC',kind:'EQUIPMENT',slot:'title',cap:1,description:'Gelar kosmetik, tersedia setelah 25 game dimainkan.'})
]);
const BY_ID = new Map(CATALOG.map(x=>[x.id,x]));
const jakartaDay = now => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
export function itemCatalog() {return CATALOG.map(x=>({...x}));}
export function initInventory(db){
 db.exec(`
 CREATE TABLE IF NOT EXISTS item_stacks (
   user_id TEXT NOT NULL REFERENCES users(id),item_id TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 30),
   PRIMARY KEY(user_id,item_id)
 );
 CREATE TABLE IF NOT EXISTS item_equipment (
   user_id TEXT NOT NULL REFERENCES users(id),slot TEXT NOT NULL CHECK(slot IN('badge','frame','title')),item_id TEXT NOT NULL,
   PRIMARY KEY(user_id,slot),FOREIGN KEY(user_id,item_id) REFERENCES item_stacks(user_id,item_id)
 );
 CREATE TABLE IF NOT EXISTS item_events (
   event_key TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),item_id TEXT NOT NULL,
   delta INTEGER NOT NULL,reason TEXT NOT NULL,created_ms INTEGER NOT NULL
 );
 CREATE INDEX IF NOT EXISTS idx_item_events_user_time ON item_events(user_id,created_ms DESC);
 `);
}
export function createInventory({db}) {
 const count=(userId,id)=>db.prepare('SELECT quantity FROM item_stacks WHERE user_id=? AND item_id=?').get(userId,id)?.quantity??0;
 const owned=(userId)=>db.prepare('SELECT item_id,quantity FROM item_stacks WHERE user_id=? ORDER BY item_id').all(userId);
 const equipment=(userId)=>db.prepare('SELECT slot,item_id FROM item_equipment WHERE user_id=? ORDER BY slot').all(userId);
 // All mutations run inside createCore.process() BEGIN IMMEDIATE. No nested transactions.
 function mutate(userId,id,delta,reason,key,now) {
   const item=BY_ID.get(id);if(!item||!Number.isSafeInteger(delta)||delta===0)throw Error('Invalid item mutation');
   const old=count(userId,id),next=old+delta;
   if(next<0||next>item.cap)return {ok:false,reason:next<0?'NOT_OWNED':'CAP_REACHED'};
   if(db.prepare('SELECT 1 FROM item_events WHERE event_key=?').get(key))return {ok:false,reason:'DUPLICATE'};
   if(next)db.prepare(`INSERT INTO item_stacks(user_id,item_id,quantity) VALUES(?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=excluded.quantity`).run(userId,id,next);
   else db.prepare('DELETE FROM item_stacks WHERE user_id=? AND item_id=?').run(userId,id);
   db.prepare('INSERT INTO item_events(event_key,user_id,item_id,delta,reason,created_ms) VALUES(?,?,?,?,?,?)').run(key,userId,id,delta,reason,now);
   return {ok:true,quantity:next};
 }
 function describeEquip(userId){return equipment(userId).map(x=>`${x.slot}: ${x.item_id}`).join(' | ')||'Belum ada';}
 function show(userId){
   const rows=owned(userId);
   return `🎒 INVENTORY (${rows.length}/${CATALOG.length} jenis)\n${rows.length?rows.map(r=>`• ${BY_ID.get(r.item_id)?.name??r.item_id} ×${r.quantity} [${r.item_id}]`).join('\n'):'Kosong. Klaim kit dengan .item claim starter'}\n🎨 Dipakai: ${describeEquip(userId)}\n.item list | .item info ID | .item claim starter | .item daily`;
 }
 function grantStarter(userId,now){
   if(db.prepare('SELECT 1 FROM item_events WHERE event_key=?').get(`item:starter:${userId}:focus`))return '🎁 Starter Kit sudah pernah diklaim.';
   const a=mutate(userId,'focus-token',2,'starter',`item:starter:${userId}:focus`,now);
   const b=mutate(userId,'hint-scroll',1,'starter',`item:starter:${userId}:hint`,now);
   if(!a.ok||!b.ok)throw Error('Starter transaction failed');
   return '🎁 Starter Kit: +2 Focus Token, +1 Hint Scroll. Coba .item use focus-token';
 }
 function claimMilestone(userId,now){
   const p=db.prepare('SELECT plays FROM player_stats WHERE user_id=?').get(userId);
   const messages=[];
   for(const [id,target] of [['jade-frame',10],['veteran-title',25]]){
     if((p?.plays??0)<target){messages.push(`${id}: perlu ${target} game`);continue;}
     const r=mutate(userId,id,1,'milestone',`item:milestone:${userId}:${id}`,now);
     messages.push(`${id}: ${r.ok?'berhasil diklaim':r.reason==='DUPLICATE'?'sudah diklaim':'sudah dimiliki'}`);
   }
   return '🏆 Milestone Items\n'+messages.join('\n');
 }
 function claimPioneer(userId,now){
   if(jakartaDay(now)>'2026-12-31')return '🏅 Event Pioneer Badge telah ditutup.';
   const r=mutate(userId,'pioneer-badge',1,'limited-free-claim',`item:pioneer:${userId}`,now);
   return r.ok?'🏅 Pioneer Badge eksklusif didapat gratis! Gunakan .item equip pioneer-badge': 'Badge Pioneer sudah diklaim.';
 }
 function claimDaily(userId,now){
   const day=jakartaDay(now);const item=Number(day.replaceAll('-',''))%2===0?'hint-scroll':'focus-token';
   const r=mutate(userId,item,1,'daily-item',`item:daily:${userId}:${day}`,now);
   return r.ok?`📦 Item harian +1 ${BY_ID.get(item).name}. Reset 00:00 WIB.`:r.reason==='CAP_REACHED'?'Inventory penuh untuk item harian ini. Gunakan item dahulu.':'📦 Item hari ini sudah diklaim.';
 }
 function equip(userId,id){
   const item=BY_ID.get(id);
   if(!item||item.kind!=='EQUIPMENT')return 'Item tidak dapat dipakai sebagai equipment.';
   if(!count(userId,id))return 'Anda belum memiliki item ini.';
   db.prepare('INSERT INTO item_equipment(user_id,slot,item_id) VALUES(?,?,?) ON CONFLICT(user_id,slot) DO UPDATE SET item_id=excluded.item_id').run(userId,item.slot,id);
   return `✅ ${item.name} dipakai pada slot ${item.slot}. Cek .profile`;
 }
 function unequip(userId,slot){
   if(!['badge','frame','title'].includes(slot))return 'Gunakan .item unequip badge | frame | title';
   const r=db.prepare('DELETE FROM item_equipment WHERE user_id=? AND slot=?').run(userId,slot);
   return r.changes?'✅ Equipment dilepas.':'Slot sudah kosong.';
 }
 function use(userId,id,key,now){
   const item=BY_ID.get(id);
   if(!item||item.kind!=='CONSUMABLE')return 'Item ini tidak bisa dikonsumsi.';
   if(!count(userId,id))return 'Anda tidak memiliki item ini.';
   if(id==='focus-token'){
     const day=jakartaDay(now);
     if(db.prepare("SELECT 1 FROM item_events WHERE user_id=? AND reason='use-focus' AND created_ms>=? AND created_ms<? LIMIT 1").get(userId,Date.parse(day+'T00:00:00+07:00'),Date.parse(day+'T00:00:00+07:00')+86400000))return 'Focus Token hanya bisa digunakan satu kali per hari WIB.';
     const r=mutate(userId,id,-1,'use-focus',`item:use:${key}`,now);
     if(!r.ok)return 'Item sudah digunakan.';
     db.prepare('UPDATE player_stats SET xp=xp+10 WHERE user_id=?').run(userId);
     return '✨ Focus Token digunakan: +10 XP (maksimum 1×/hari).';
   }
   const session=db.prepare("SELECT secret,updated_at FROM game_sessions WHERE user_id=? AND name='guess'").get(userId);
   if(!session||now-session.updated_at>900000||now<session.updated_at)return 'Aktifkan .guess start terlebih dahulu (item belum dikonsumsi).';
   const r=mutate(userId,id,-1,'use-guess-hint',`item:use:${key}`,now);
   if(!r.ok)return 'Item sudah digunakan.';
   return `🔎 Petunjuk: angka ${session.secret%2===0?'genap':'ganjil'} dan berada di ${session.secret<=5?'rentang 1–5':'rentang 6–10'}.`;
 }
 function dispatch(userId,eventKey,text,now){
   const parts=text.trim().toLowerCase().split(/\s+/);const cmd=parts[0],a=parts.slice(1);
   if(!['.inventory','.inv','.item','.collection'].includes(cmd))return null;
   if(cmd==='.inventory'||cmd==='.inv')return show(userId);
   if(cmd==='.collection'){
     const got=new Set(owned(userId).map(x=>x.item_id));
     return `🏛️ KOLEKSI ${got.size}/${CATALOG.length}\n${CATALOG.map(i=>`${got.has(i.id)?'✅':'⬜'} ${i.name} [${i.rarity}]`).join('\n')}\nKlaim .item claim milestones atau pioneer`;
   }
   if(!a.length||a[0]==='help')return '🎒 .inventory | .collection\n.item list | info ID\n.item claim starter|milestones|pioneer\n.item daily | .item history\n.item equip ID | unequip SLOT\n.item use focus-token|hint-scroll';
   if(a[0]==='list')return '📦 KATALOG ITEM\n'+CATALOG.map(i=>`• ${i.name} [${i.rarity}] ${i.kind} — ${i.id}`).join('\n');
   if(a[0]==='info'){const i=BY_ID.get(a[1]);return i?`${i.name} [${i.rarity}]\n${i.description}\nDimiliki: ${count(userId,i.id)} / ${i.cap}\nTipe: ${i.kind}${i.slot?' • slot '+i.slot:''}`:'ID item tidak ditemukan. Ketik .item list';}
   if(a[0]==='claim'){
     if(a[1]==='starter')return grantStarter(userId,now);
     if(a[1]==='milestones')return claimMilestone(userId,now);
     if(a[1]==='pioneer')return claimPioneer(userId,now);
     return 'Pilih .item claim starter | milestones | pioneer';
   }
   if(a[0]==='daily')return claimDaily(userId,now);
   if(a[0]==='equip')return equip(userId,a[1]);
   if(a[0]==='unequip')return unequip(userId,a[1]);
   if(a[0]==='use')return use(userId,a[1],eventKey,now);
   if(a[0]==='history'){
     const rows=db.prepare('SELECT item_id,delta,reason,created_ms FROM item_events WHERE user_id=? ORDER BY created_ms DESC,rowid DESC LIMIT 10').all(userId);
     return rows.length?'📜 Riwayat item\n'+rows.map(r=>`${r.delta>0?'+':''}${r.delta} ${r.item_id} — ${r.reason}`).join('\n'):'Belum ada riwayat item.';
   }
   return 'Perintah item tidak dikenal. Coba .item help';
 }
 return {dispatch,show,equipment:describeEquip,catalog:itemCatalog,stats:()=>({types:CATALOG.length,owners:Number(db.prepare('SELECT COUNT(DISTINCT user_id) AS n FROM item_stacks').get().n),events:Number(db.prepare('SELECT COUNT(*) AS n FROM item_events').get().n)})};
}
