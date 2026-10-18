/** WOW V3 stage 1: safe opt-in group chat mirror. Never deletes originals or impersonates sender. */
import {createHash} from 'node:crypto';
import {inTransaction} from '../db.js';
import {unwrap} from './message.js';
import {createChatCosmetics} from './chat-cosmetics.js';
import {createChatSignatures} from './chat-signatures.js';
import {originalGroupMessageKey,restoreGroupMessageKey} from './revoke-key.js';

const CURRENT_LIMIT=280;
const QUEUE_CAP=300;
const GROUP_CAP=30;
const MAX_AGE_MS=45_000;
const PLAYER_GAP_MS=6_000;
const GROUP_GAP_MS=1_500;
const DELETE_ACK_TTL_MS=20_000; // Never delete an old source message after reconnect/downtime.
const DELIVERED_STATUS=3; // Baileys WAProto WebMessageInfo.Status.DELIVERY_ACK (not SERVER_ACK=2)
const idHash = id => createHash('sha256').update(id).digest('hex').slice(0,8).toUpperCase();
const trimName = name => String(name ?? '').replace(/[\r\n\t\u0000-\u001f\u007f]/g,' ').replace(/[@*`~]/g,'').trim().slice(0,24);
const str = x => typeof x==='string' ? x : '';

export function plainGroupText(msg){
 const m=unwrap(msg?.message);
 // Stage 1 intentionally ignores media captions, quoted payloads, views, polls and service events.
 const raw=m?.conversation ?? m?.extendedTextMessage?.text;
 if(typeof raw!=='string' || !raw.trim() || raw.length>CURRENT_LIMIT || raw.trim().startsWith('.'))return null;
 if(/[\u0000-\u0008\u000e-\u001f]/.test(raw))return null;
 return raw.trim();
}
export function initChatIdentity(db){
 db.exec(`CREATE TABLE IF NOT EXISTS wow_chat_global (singleton INTEGER PRIMARY KEY CHECK(singleton=1),enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),updated_ms INTEGER NOT NULL DEFAULT 0);
 INSERT OR IGNORE INTO wow_chat_global(singleton,enabled,updated_ms) VALUES(1,0,0);
 CREATE TABLE IF NOT EXISTS wow_chat_groups(group_id TEXT PRIMARY KEY,enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),mode TEXT NOT NULL DEFAULT 'identity' CHECK(mode IN ('identity','mirror','replace')),updated_ms INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS wow_chat_users(user_id TEXT PRIMARY KEY REFERENCES users(id),consent INTEGER NOT NULL DEFAULT 0 CHECK(consent IN(0,1)),updated_ms INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS wow_chat_blocks(group_id TEXT NOT NULL,user_id TEXT NOT NULL,created_ms INTEGER NOT NULL,PRIMARY KEY(group_id,user_id));
 CREATE TABLE IF NOT EXISTS wow_chat_commands(event_key TEXT PRIMARY KEY,response TEXT NOT NULL,created_ms INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS wow_chat_audit(event_key TEXT PRIMARY KEY,actor_id TEXT NOT NULL,scope TEXT NOT NULL,action TEXT NOT NULL,value TEXT NOT NULL,created_ms INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS wow_chat_queue (source_key TEXT PRIMARY KEY,group_id TEXT NOT NULL,sender_id TEXT NOT NULL,body TEXT,status TEXT NOT NULL CHECK(status IN('PENDING','SENDING','SENT','FAILED','SKIPPED','AMBIGUOUS')),created_ms INTEGER NOT NULL,attempted_ms INTEGER NOT NULL DEFAULT 0,finished_ms INTEGER NOT NULL DEFAULT 0,result_id TEXT,reason TEXT);
 CREATE INDEX IF NOT EXISTS idx_wow_chat_pending ON wow_chat_queue(status,created_ms);
 CREATE TABLE IF NOT EXISTS wow_chat_rate(group_id TEXT NOT NULL,sender_id TEXT NOT NULL,last_ms INTEGER NOT NULL,PRIMARY KEY(group_id,sender_id));
 CREATE TABLE IF NOT EXISTS wow_chat_rate_group(group_id TEXT PRIMARY KEY,last_ms INTEGER NOT NULL);`);
 // Non-destructive migration for existing v3.0 SQLite. Rebuild only group policy table
 // because its CHECK constraint did not include replace. No user balances are touched.
 const def=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='wow_chat_groups'").get()?.sql??'';
 if(!def.includes("'replace'"))inTransaction(db,()=>{
  db.exec(`CREATE TABLE wow_chat_groups_v31 (group_id TEXT PRIMARY KEY,enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),mode TEXT NOT NULL DEFAULT 'identity' CHECK(mode IN('identity','mirror','replace')),updated_ms INTEGER NOT NULL,delete_enabled INTEGER NOT NULL DEFAULT 0 CHECK(delete_enabled IN(0,1)));
  INSERT INTO wow_chat_groups_v31(group_id,enabled,mode,updated_ms) SELECT group_id,enabled,mode,updated_ms FROM wow_chat_groups;
  DROP TABLE wow_chat_groups;
  ALTER TABLE wow_chat_groups_v31 RENAME TO wow_chat_groups;`);
 });
 const col=(table,name,definition)=>{
  const exists=db.prepare(`PRAGMA table_info(${table})`).all().some(x=>x.name===name);
  if(!exists)db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
 };
 col('wow_chat_global','replace_enabled','INTEGER NOT NULL DEFAULT 0 CHECK(replace_enabled IN (0,1))');
 col('wow_chat_groups','delete_enabled','INTEGER NOT NULL DEFAULT 0 CHECK(delete_enabled IN (0,1))');
 col('wow_chat_users','replace_consent','INTEGER NOT NULL DEFAULT 0 CHECK(replace_consent IN (0,1))');
 col('wow_chat_queue','source_id','TEXT');
 col('wow_chat_queue','source_sender_id','TEXT');
 col('wow_chat_queue','source_key_json','TEXT');
 col('wow_chat_queue','delete_state',"TEXT NOT NULL DEFAULT 'NONE'");
 col('wow_chat_queue','delete_attempted_ms','INTEGER NOT NULL DEFAULT 0');
 db.exec('CREATE INDEX IF NOT EXISTS idx_wow_chat_delete ON wow_chat_queue(delete_state,attempted_ms)');
 db.exec(`CREATE TABLE IF NOT EXISTS wow_chat_diagnostics (group_id TEXT NOT NULL,reason TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,updated_ms INTEGER NOT NULL,PRIMARY KEY(group_id,reason))`);
}
export function createChatIdentity({db,adminIds=process.env.WOW_ADMIN_IDS??'',now=()=>Date.now()}={}){
 if(!db)throw Error('Chat Identity requires DB');
 initChatIdentity(db);
 const cosmetics=createChatCosmetics(db);
 const signatures=createChatSignatures(db);
 const admins=new Set((Array.isArray(adminIds)?adminIds:String(adminIds).split(',')).map(x=>x.trim()).filter(Boolean));
 const isAdmin=id=>admins.has(id);
 const global=()=>db.prepare('SELECT enabled FROM wow_chat_global WHERE singleton=1').get().enabled===1;
 const group=id=>db.prepare('SELECT enabled,mode,delete_enabled FROM wow_chat_groups WHERE group_id=?').get(id)??{enabled:0,mode:'identity',delete_enabled:0};
 const replaceGlobal=()=>db.prepare('SELECT replace_enabled FROM wow_chat_global WHERE singleton=1').get().replace_enabled===1;
 const acceptsGroup=id=>{const g=group(id);return global()&&g.enabled===1&&['mirror','replace'].includes(g.mode);};
 const replaceConsent=id=>db.prepare('SELECT replace_consent FROM wow_chat_users WHERE user_id=?').get(id)?.replace_consent===1;
 const canReplace=(jid,sender)=>global()&&replaceGlobal()&&group(jid).enabled===1&&group(jid).mode==='replace'&&group(jid).delete_enabled===1&&consenting(sender)&&replaceConsent(sender)&&!db.prepare('SELECT 1 FROM wow_chat_blocks WHERE group_id=? AND user_id=?').get(jid,sender);
 const consenting=id=>db.prepare('SELECT consent FROM wow_chat_users WHERE user_id=?').get(id)?.consent===1;
 // WhatsApp may address the same participant by phone JID in DM and by LID in a group.
 // Never guess numeric identities: accept only alternate IDs supplied by the gateway.
 const identityFor=(raw,alt)=>[raw,alt].filter(x=>typeof x==='string'&&x.includes('@')).find(consenting)??raw;
 const isBlocked=(groupId,raw,canonical)=>[...new Set([raw,canonical])].some(id=>!!db.prepare('SELECT 1 FROM wow_chat_blocks WHERE group_id=? AND user_id=?').get(groupId,id));
 const reject=(jid,reason,at)=>{if(jid?.endsWith('@g.us')&&['no-consent','disabled','replace-not-authorized','blocked','not-plain-text','player-rate','backpressure','duplicate'].includes(reason))db.prepare('INSERT INTO wow_chat_diagnostics(group_id,reason,count,updated_ms) VALUES(?,?,1,?) ON CONFLICT(group_id,reason) DO UPDATE SET count=count+1,updated_ms=excluded.updated_ms').run(jid,reason,at);return {accepted:false,reason};};
 function profile(id){
  const p=db.prepare('SELECT nickname FROM player_stats WHERE user_id=?').get(id);
  const badge=Object.entries(cosmetics.resolved(id)).filter(([,item])=>item).map(([slot,item_id])=>({slot,item_id}));
  const guild=db.prepare('SELECT g.slug FROM wow_guild_members m JOIN wow_guilds g ON m.guild_id=g.id WHERE m.user_id=? AND g.closed=0').get(id)?.slug??null;
  return {name:trimName(p?.nickname)||`Player-${idHash(id).slice(0,6)}`,badge,guild:trimName(guild)};
 }
 function render(id,body){
  const p=profile(id),eq=Object.fromEntries(p.badge.map(e=>[e.slot,e.item_id]));
  const badge=eq.badge==='pioneer-badge'?'🏅 PIONEER':eq.badge?'🏅 '+eq.badge.toUpperCase():'';
  const title=eq.title==='veteran-title'?'VETERAN':(eq.title??'EXPLORER').replaceAll('-',' ').toUpperCase();
  const frame=eq.frame==='jade-frame'?'💠':'✦';
  const signature=signatures.render(id);
  const header=`${signature??frame} WOW IDENTITY • ${title}${badge?' • '+badge:''}${p.guild?' • 🛡️ '+p.guild:''}`;
  const safeBody=str(body).replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,CURRENT_LIMIT);
  return `${header}\n👤 @${p.name} [WOW-${idHash(id)}]\n${frame} ${safeBody}\n↳ Ditulis pemain di atas • diterbitkan WOW Bot`;
 }
 function command({senderId,chatId,isGroup=false,groupAdmin=false,mentionedJids=[],eventKey,text,at=now()}){
  const words=str(text).trim().split(/\s+/),root=words[0]?.toLowerCase();
  if(!['.chatstyle','.wowchat'].includes(root) && !(root==='.admin' && words[1]==='chat'))return null;
  if(!senderId || !eventKey || !chatId)return 'Perintah invalid.';
  return inTransaction(db,()=>{
   const prev=db.prepare('SELECT response FROM wow_chat_commands WHERE event_key=?').get(eventKey);
   if(prev)return prev.response;
   const log=(scope,action,value)=>db.prepare('INSERT INTO wow_chat_audit VALUES(?,?,?,?,?,?)').run(eventKey,senderId,scope,action,String(value),at);
   let out;
   if(root==='.admin'){
    if(isGroup || !isAdmin(senderId))out='⛔ Hanya admin WOW melalui chat pribadi.';
    else if(words[2]==='global' && ['on','off'].includes(words[3])){
     const en=words[3]==='on'?1:0;
     db.prepare('UPDATE wow_chat_global SET enabled=?,updated_ms=? WHERE singleton=1').run(en,at);
     if(!en)db.prepare('UPDATE wow_chat_groups SET delete_enabled=0').run();
     log('SERVER','GLOBAL',en);
     out=`✅ WOW Chat global ${en?'ON':'OFF'}. Status group/pemain tetap berlaku.`;
    }else if(words[2]==='replace' && ['on','off'].includes(words[3])){
     const en=words[3]==='on'?1:0;
     db.prepare('UPDATE wow_chat_global SET replace_enabled=?,updated_ms=? WHERE singleton=1').run(en,at);
     if(!en)db.prepare('UPDATE wow_chat_groups SET delete_enabled=0').run();
     log('SERVER','REPLACE',en);
     out=`✅ Izin Replace server ${en?'ON':'OFF'}. Masih memerlukan izin grup, admin bot, serta persetujuan pribadi pemain.`;
    }else out=`⚙️ WOW Chat server: ${global()?'ON':'OFF'} • Replace: ${replaceGlobal()?'ON':'OFF'}\n.admin chat global on|off\n.admin chat replace on|off\nGroup tetap memerlukan admin grup dan persetujuan pemain.`;
   }else if(root==='.chatstyle'){
    if(isGroup)out='Atur .chatstyle on|off|preview hanya lewat DM.';
    else {
     db.prepare('INSERT OR IGNORE INTO users(id) VALUES(?)').run(senderId);
     db.prepare('INSERT OR IGNORE INTO player_stats(user_id) VALUES(?)').run(senderId);
     db.prepare('INSERT OR IGNORE INTO wallets(user_id) VALUES(?)').run(senderId);
     const op=words[1]?.toLowerCase();
     if(op==='signature'){out=signatures.execute(senderId,eventKey,words.slice(2),at);}
     else if(op==='replace' && ['on','off'].includes(words[2])){
      const v=words[2]==='on'?1:0;
      db.prepare('INSERT INTO wow_chat_users(user_id,consent,updated_ms,replace_consent) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET replace_consent=excluded.replace_consent,updated_ms=excluded.updated_ms').run(senderId,consenting(senderId)?1:0,at,v);
      log('PLAYER','REPLACE_CONSENT',v);out=`✅ Izin hapus pesan asli ${v?'ON':'OFF'}. Berlaku hanya di grup Replace yang diizinkan admin.`;
     }else if(op==='on'||op==='off'){
      const v=op==='on'?1:0;
      db.prepare('INSERT INTO wow_chat_users(user_id,consent,updated_ms) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET consent=excluded.consent,updated_ms=excluded.updated_ms').run(senderId,v,at);
      if(!v)db.prepare('UPDATE wow_chat_users SET replace_consent=0 WHERE user_id=?').run(senderId);
      log('PLAYER','CONSENT',v);
      out=`✅ Chat Identity ${op.toUpperCase()}. ${v?'Berlaku hanya di grup yang juga mengaktifkan Mirror.':'Pesan Anda tidak akan dicerminkan.'}`;
     }else if(op==='preview')out=render(senderId,'Halo dunia WOW! Ini pratinjau dekorasi chat.');
     else if(op==='preset')out=cosmetics.execute(senderId,words.slice(2),at);
     else if(op==='stats'){
      const r=db.prepare("SELECT COUNT(*) total,SUM(CASE WHEN status='SENT' THEN 1 ELSE 0 END) sent,SUM(CASE WHEN status='SKIPPED' THEN 1 ELSE 0 END) skipped FROM wow_chat_queue WHERE sender_id=?").get(senderId);
      out=`📊 WOW CHAT STATS\nDiterima: ${r.total??0} • Dikirim: ${r.sent??0} • Dilewati: ${r.skipped??0}\nPreset: ${cosmetics.selected(senderId)??'equipment aktif'}`;
     }
     else out=`🎭 WOW CHAT STYLE\nMirror: ${consenting(senderId)?'ON':'OFF'} • Replace: ${replaceConsent(senderId)?'ON':'OFF'}\n.chatstyle on|off|preview|stats\n.chatstyle preset list|save|use|remove|off\n.chatstyle replace on|off\nEquipment: .inventory / .item equip ID`;
    }
   }else {
    if(!isGroup)out='Gunakan .wowchat hanya di dalam grup. Admin WOW: .admin chat global on';
    else if(!groupAdmin && !isAdmin(senderId))out='⛔ Hanya admin WhatsApp grup atau admin WOW.';
    else {
     const op=words[1]?.toLowerCase(),g=group(chatId);
     if(op==='enable'||op==='disable'){
      const v=op==='enable'?1:0;
      if(v&&!global())out='🔒 Admin WOW belum mengaktifkan dekorasi secara global.';
      else {
       db.prepare('INSERT INTO wow_chat_groups(group_id,enabled,mode,updated_ms) VALUES(?,?,?,?) ON CONFLICT(group_id) DO UPDATE SET enabled=excluded.enabled,updated_ms=excluded.updated_ms').run(chatId,v,g.mode,at);
       if(!v)db.prepare('UPDATE wow_chat_groups SET delete_enabled=0 WHERE group_id=?').run(chatId);
       log(chatId,'ENABLED',v);out=`✅ WOW Chat grup ${v?'ON':'OFF'}. Mode: ${g.mode}.`;
      }
     }else if(op==='mode'){
      if(!['identity','mirror','replace'].includes(words[2]))out='Gunakan .wowchat mode identity|mirror|replace.';
      else if(words[2]==='replace' && !replaceGlobal())out='🔒 Admin WOW belum mengizinkan Replace di server.';
      else {
       db.prepare('INSERT INTO wow_chat_groups(group_id,enabled,mode,updated_ms) VALUES(?,?,?,?) ON CONFLICT(group_id) DO UPDATE SET mode=excluded.mode,updated_ms=excluded.updated_ms').run(chatId,g.enabled,words[2],at);
       if(words[2]!=='replace')db.prepare('UPDATE wow_chat_groups SET delete_enabled=0 WHERE group_id=?').run(chatId);
       log(chatId,'MODE',words[2]);out=`✅ Mode grup: ${words[2]}. ${words[2]==='replace'?'Penghapusan tetap OFF sampai .wowchat delete on.':''}`;
      }
     }else if(op==='delete' && ['on','off'].includes(words[2])){
      const v=words[2]==='on'?1:0;
      if(v&&(!replaceGlobal()||g.mode!=='replace'))out='🔒 Set server Replace ON dan pilih .wowchat mode replace terlebih dahulu.';
      else {db.prepare('UPDATE wow_chat_groups SET delete_enabled=?,updated_ms=? WHERE group_id=?').run(v,at,chatId);log(chatId,'DELETE',v);out=`✅ Izin hapus grup ${v?'ON':'OFF'}. Bot harus admin dan pemain harus opt-in.`;}
     }else if(op==='block'||op==='unblock'){
      const target=mentionedJids[0];
      if(!target || target===senderId || !target.includes('@'))out=`Tag satu anggota dengan mention WhatsApp asli. .wowchat ${op} @anggota`;
      else {
       if(op==='block')db.prepare('INSERT OR IGNORE INTO wow_chat_blocks VALUES(?,?,?)').run(chatId,target,at);
       else db.prepare('DELETE FROM wow_chat_blocks WHERE group_id=? AND user_id=?').run(chatId,target);
       log(chatId,op.toUpperCase(),idHash(target));out=`✅ Dekorasi akun tersebut ${op==='block'?'dinonaktifkan':'diizinkan'} di grup ini.`;
      }
     }else if(op==='diagnose'){
      const reasons=db.prepare('SELECT reason,count FROM wow_chat_diagnostics WHERE group_id=? ORDER BY count DESC LIMIT 7').all(chatId);
      const recent=db.prepare("SELECT status,COUNT(*) AS n FROM wow_chat_queue WHERE group_id=? GROUP BY status").all(chatId);
      const deletes=db.prepare("SELECT delete_state,COUNT(*) AS n FROM wow_chat_queue WHERE group_id=? GROUP BY delete_state").all(chatId);
      out=`🩺 WOW CHAT DIAGNOSE\nServer: ${global()?'ON':'OFF'} | Grup: ${g.enabled?'ON':'OFF'} | Mode: ${g.mode} | Delete: ${g.delete_enabled?'ON':'OFF'}\nAntrean menurut status: ${recent.map(x=>x.status+': '+x.n).join(', ')||'kosong'}\nPenghapusan: ${deletes.map(x=>x.delete_state+': '+x.n).join(', ')||'kosong'}\nStatus revoke: REQUESTED tidak membuktikan terhapus dari semua HP. Untuk WAIT_ACK periksa receipt; untuk FAILED_DELETE periksa log gateway.\nAlasan Delete: ${db.prepare("SELECT reason,COUNT(*) n FROM wow_chat_queue WHERE group_id=? AND reason IS NOT NULL GROUP BY reason ORDER BY n DESC LIMIT 5").all(chatId).map(x=>x.reason+': '+x.n).join(', ')||'belum ada'}\nAlasan dilewati (akumulatif):\n${reasons.map(x=>x.reason+': '+x.count).join('\n')||'(belum ada)'}\nPesan biasa hanya diproses jika pemain .chatstyle on di DM. Tidak memerlukan badge.`;
     }else out=`🎭 WOW GROUP CHAT\nServer ${global()?'ON':'OFF'} • Replace ${replaceGlobal()?'ON':'OFF'} • Grup ${g.enabled?'ON':'OFF'} • Mode ${g.mode} • Delete ${g.delete_enabled?'ON':'OFF'}\n.wowchat enable|disable\n.wowchat mode identity|mirror|replace\n.wowchat delete on|off\n.wowchat block|unblock @mention\n.wowchat diagnose`;
    }
   }
   db.prepare('INSERT INTO wow_chat_commands(event_key,response,created_ms) VALUES(?,?,?)').run(eventKey,out,at);
   return out;
  });
 }
 function ingest(msg,at=now()){
  const jid=msg?.key?.remoteJid,rawSender=msg?.key?.participant,altSender=msg?.key?.participantAlt,mid=msg?.key?.id;
  if(!jid?.endsWith('@g.us')||!rawSender||!mid||msg.key.fromMe||mid.length>160)return {accepted:false,reason:'not-group-input'};
  const body=plainGroupText(msg);
  if(body===null)return reject(jid,'not-plain-text',at);
  const state=group(jid),mode=state.mode;
  if(!global() || state.enabled!==1 || (mode!=='mirror' && mode!=='replace'))return reject(jid,'disabled',at);
  const sender=identityFor(rawSender,altSender);
  // A player without equipment uses the default Explorer identity, but must opt in.
  if(!consenting(sender))return reject(jid,'no-consent',at);
  // Never suppress a common player's chat just because deletion permission is
  // missing. Fall back to non-deleting decoration, and report the reason.
  const deleteAllowed=mode==='replace' && canReplace(jid,sender);
  if(mode==='replace'&&!deleteAllowed) reject(jid,'replace-not-authorized',at);
  if(isBlocked(jid,rawSender,sender))return reject(jid,'blocked',at);
  const sourceKey=`${jid}:${rawSender}:${mid}`;
  const originalKey=originalGroupMessageKey(msg.key);
  return inTransaction(db,()=>{
   if(db.prepare('SELECT 1 FROM wow_chat_queue WHERE source_key=?').get(sourceKey))return reject(jid,'duplicate',at);
   if(db.prepare("SELECT COUNT(*) AS n FROM wow_chat_queue WHERE status='PENDING'").get().n>=QUEUE_CAP || db.prepare("SELECT COUNT(*) AS n FROM wow_chat_queue WHERE group_id=? AND status='PENDING'").get(jid).n>=GROUP_CAP)return reject(jid,'backpressure',at);
   const playerLast=db.prepare('SELECT last_ms FROM wow_chat_rate WHERE group_id=? AND sender_id=?').get(jid,sender)?.last_ms??0;
   if(at-playerLast<PLAYER_GAP_MS)return reject(jid,'player-rate',at);
   db.prepare('INSERT INTO wow_chat_queue(source_key,group_id,sender_id,body,status,created_ms,source_id,delete_state,source_sender_id,source_key_json) VALUES(?,?,?,?,?,?,?,?,?,?)').run(sourceKey,jid,sender,body,'PENDING',at,deleteAllowed?mid:null,deleteAllowed?'PENDING':'NONE',rawSender,deleteAllowed&&originalKey?JSON.stringify(originalKey):null);
   db.prepare('INSERT INTO wow_chat_rate(group_id,sender_id,last_ms) VALUES(?,?,?) ON CONFLICT(group_id,sender_id) DO UPDATE SET last_ms=excluded.last_ms').run(jid,sender,at);
   return {accepted:true,sourceKey};
  });
 }
 function recover(){
  const t=now();
  const n=db.prepare("UPDATE wow_chat_queue SET status='AMBIGUOUS',body=NULL,reason='restart-in-flight',finished_ms=?,delete_state='AMBIGUOUS' WHERE status='SENDING'").run(t).changes;
  // No old message may be deleted just because a previous delivery was acknowledged.
  db.prepare("UPDATE wow_chat_queue SET delete_state='AMBIGUOUS' WHERE delete_state IN ('WAIT_ACK','READY','DELETE_IN_FLIGHT')").run();
  return n;
 }
 function claim(at=now()){
  return inTransaction(db,()=>{
   db.prepare("UPDATE wow_chat_queue SET status='SKIPPED',body=NULL,reason='expired',finished_ms=? WHERE status='PENDING' AND created_ms<?").run(at,at-MAX_AGE_MS);
   const entries=db.prepare("SELECT source_key,group_id,sender_id,source_sender_id,body,created_ms,source_id,delete_state FROM wow_chat_queue WHERE status='PENDING' ORDER BY created_ms LIMIT 35").all();
   for(const e of entries){
    // Consent to decoration can remain valid even when the author or an admin
    // revokes delete permission while a message is queued. Degrade to mirror.
    if(e.delete_state==='PENDING' && !canReplace(e.group_id,e.sender_id)){
     db.prepare("UPDATE wow_chat_queue SET delete_state='SKIPPED',source_id=NULL,source_key_json=NULL,reason='replace-permission-changed' WHERE source_key=?").run(e.source_key);
     e.delete_state='SKIPPED';e.source_id=null;
    }
    if(!global()||group(e.group_id).enabled!==1||!['mirror','replace'].includes(group(e.group_id).mode)||!consenting(e.sender_id)||isBlocked(e.group_id,e.source_sender_id??e.sender_id,e.sender_id)){
     db.prepare("UPDATE wow_chat_queue SET status='SKIPPED',body=NULL,reason='policy-changed',finished_ms=? WHERE source_key=?").run(at,e.source_key);continue;
    }
    const last=db.prepare('SELECT last_ms FROM wow_chat_rate_group WHERE group_id=?').get(e.group_id)?.last_ms??0;
    if(at-last<GROUP_GAP_MS)continue;
    db.prepare("UPDATE wow_chat_queue SET status='SENDING',attempted_ms=? WHERE source_key=? AND status='PENDING'").run(at,e.source_key);
    db.prepare('INSERT INTO wow_chat_rate_group(group_id,last_ms) VALUES(?,?) ON CONFLICT(group_id) DO UPDATE SET last_ms=excluded.last_ms').run(e.group_id,at);
    return {...e,text:render(e.sender_id,e.body),mentions:[e.source_sender_id??e.sender_id]};
   }
   return null;
  });
 }
 function finish(sourceKey,success,resultId='',at=now()){
  const status=success?'SENT':'FAILED';
  const result=str(resultId).slice(0,180);
  return db.prepare("UPDATE wow_chat_queue SET status=?,body=NULL,finished_ms=?,result_id=?,reason=?,delete_state=CASE WHEN delete_state='PENDING' AND ?=1 AND length(?)>0 THEN 'WAIT_ACK' WHEN delete_state='PENDING' THEN 'SKIPPED' ELSE delete_state END WHERE source_key=? AND status='SENDING'").run(status,at,result,success?null:'send-failed',success?1:0,result,sourceKey).changes;
 }
 /** Only a real delivery acknowledgement of the bot message authorizes a delete attempt.
  * Status 2 is SERVER_ACK and intentionally insufficient. Ack is version sensitive,
  * so unsupported statuses fail closed. */
 function ackDelivered(key,status,at=now()){
  if(!key?.fromMe || !key?.remoteJid?.endsWith('@g.us') || !key?.id || !Number.isInteger(status) || status<DELIVERED_STATUS || status>5)return 0;
  return db.prepare("UPDATE wow_chat_queue SET delete_state='READY' WHERE group_id=? AND result_id=? AND status='SENT' AND delete_state='WAIT_ACK' AND finished_ms>=?")
    .run(key.remoteJid,key.id,at-DELETE_ACK_TTL_MS).changes;
 }
 function claimDelete(at=now()){
  return inTransaction(db,()=>{
   db.prepare("UPDATE wow_chat_queue SET delete_state='SKIPPED',reason='receipt-timeout' WHERE delete_state IN ('WAIT_ACK','READY') AND finished_ms<?").run(at-DELETE_ACK_TTL_MS);
   const jobs=db.prepare("SELECT source_key,group_id,sender_id,source_sender_id,source_id,source_key_json,finished_ms FROM wow_chat_queue WHERE delete_state='READY' ORDER BY finished_ms LIMIT 20").all();
   for(const job of jobs){
    if(!canReplace(job.group_id,job.sender_id)||!job.source_id||at-job.finished_ms>DELETE_ACK_TTL_MS){
     db.prepare("UPDATE wow_chat_queue SET delete_state='SKIPPED',reason=? WHERE source_key=?").run(!job.source_id?'missing-source-key':at-job.finished_ms>DELETE_ACK_TTL_MS?'receipt-timeout':'policy-revoked',job.source_key);continue;
    }
    const c=db.prepare("UPDATE wow_chat_queue SET delete_state='DELETE_IN_FLIGHT',delete_attempted_ms=? WHERE source_key=? AND delete_state='READY'").run(at,job.source_key);
    if(c.changes)return {...job,key:restoreGroupMessageKey(job.source_key_json,job.group_id,job.source_id,job.source_sender_id??job.sender_id)};
   }
   return null;
  });
 }
 function stillAllowedDelete(key,at=now()){
  const j=db.prepare("SELECT group_id,sender_id,finished_ms,delete_state FROM wow_chat_queue WHERE source_key=?").get(key);
  return !!j && j.delete_state==='DELETE_IN_FLIGHT' && at-j.finished_ms<=DELETE_ACK_TTL_MS && canReplace(j.group_id,j.sender_id);
 }
 function finishDelete(key,success,reason='',at=now()){
  return db.prepare("UPDATE wow_chat_queue SET delete_state=?,reason=?,delete_attempted_ms=? WHERE source_key=? AND delete_state='DELETE_IN_FLIGHT'")
    .run(success?'DELETE_REQUESTED':'FAILED_DELETE',success?null:str(reason).slice(0,120),at,key).changes;
 }
 function skipDelete(key,reason='policy-failed',at=now()){
  return db.prepare("UPDATE wow_chat_queue SET delete_state='SKIPPED',reason=?,delete_attempted_ms=? WHERE source_key=? AND delete_state='DELETE_IN_FLIGHT'")
    .run(str(reason).slice(0,120),at,key).changes;
 }
 function purge(at=now()){
  // Avoid unbounded SQLite growth without retaining message contents after delivery.
  const result=db.prepare("DELETE FROM wow_chat_queue WHERE status IN('SENT','FAILED','SKIPPED','AMBIGUOUS') AND finished_ms<?").run(at-7*86400000);
  db.prepare('DELETE FROM wow_chat_commands WHERE created_ms<?').run(at-7*86400000);
  db.prepare('DELETE FROM wow_chat_rate WHERE last_ms<?').run(at-7*86400000);
  db.prepare('DELETE FROM wow_chat_rate_group WHERE last_ms<?').run(at-7*86400000);
  return result.changes;
 }
 const stats=()=>Object.fromEntries(db.prepare('SELECT status,COUNT(*) n FROM wow_chat_queue GROUP BY status').all().map(x=>[x.status,x.n]));
 const metrics=()=>({status:stats(),groups:Number(db.prepare('SELECT COUNT(DISTINCT group_id) AS n FROM wow_chat_queue').get().n),queued:Number(db.prepare("SELECT COUNT(*) AS n FROM wow_chat_queue WHERE status='PENDING'").get().n),presets:Number(db.prepare('SELECT COUNT(*) AS n FROM wow_chat_presets').get().n)});
 return {command,ingest,acceptsGroup,claim,finish,ackDelivered,claimDelete,stillAllowedDelete,skipDelete,finishDelete,recover,purge,stats,metrics,render,isAdmin};
}
