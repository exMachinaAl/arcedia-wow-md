/** WA-WORLD v1.4 Blackjack social table: no wagering, payouts, or cash-out. */
import {randomBytes, randomInt} from 'node:crypto';
import {renderBlackjackCards} from './blackjack/cards-png.js';
export const BJ_MAX_SEATS=4;
const ROOM_TTL=30*60_000, GAME_TTL=24*60*60_000;
const nowId=()=>randomBytes(4).toString('hex').toUpperCase();
export const isPrivateJid=jid=>typeof jid==='string'&&/@(s\.whatsapp\.net|lid)$/.test(jid);
export function evaluateHand(cards){
 let total=0,aces=0;for(const card of cards){const rank=card.slice(0,-1);if(rank==='A'){total+=11;aces++;}else total+=['K','Q','J'].includes(rank)?10:Number(rank);}
 while(total>21&&aces){total-=10;aces--;}return {total,soft:aces>0,blackjack:cards.length===2&&total===21,bust:total>21};
}
export function makeShoe(rng=randomInt){
 const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'],suits=['S','H','D','C'];
 const deck=[];for(let round=0;round<4;round++)for(const rank of ranks)for(const suit of suits)deck.push(rank+suit);
 for(let i=deck.length-1;i>0;i--){const j=rng(i+1);if(!Number.isInteger(j)||j<0||j>i)throw Error('Invalid secure shuffle');[deck[i],deck[j]]=[deck[j],deck[i]];}return deck;
}
export function initBlackjack(db){db.exec(`
 CREATE TABLE IF NOT EXISTS bj_rooms (
   id TEXT PRIMARY KEY, group_jid TEXT,host_id TEXT REFERENCES users(id),status TEXT NOT NULL CHECK(status IN ('LOBBY','ACTIVE','DONE','CANCELLED','EXPIRED')),
   shoe TEXT NOT NULL DEFAULT '[]',dealer TEXT NOT NULL DEFAULT '[]',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,
   CHECK(group_jid IS NULL OR group_jid LIKE '%@g.us')
 );
 CREATE TABLE IF NOT EXISTS bj_seats (
   room_id TEXT NOT NULL REFERENCES bj_rooms(id),user_id TEXT NOT NULL REFERENCES users(id),joined_at INTEGER NOT NULL,
   hand TEXT NOT NULL DEFAULT '[]',state TEXT NOT NULL DEFAULT 'READY' CHECK(state IN ('READY','PLAY','STAND','BUST','BLACKJACK')),
   result TEXT,PRIMARY KEY(room_id,user_id)
 );
 CREATE INDEX IF NOT EXISTS idx_bj_seats_player ON bj_seats(user_id);
 CREATE TABLE IF NOT EXISTS bj_events (id INTEGER PRIMARY KEY AUTOINCREMENT,room_id TEXT NOT NULL REFERENCES bj_rooms(id),actor_id TEXT,kind TEXT NOT NULL,detail TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS bj_notices (
   id INTEGER PRIMARY KEY AUTOINCREMENT,room_id TEXT NOT NULL REFERENCES bj_rooms(id),recipient TEXT NOT NULL, event_key TEXT NOT NULL UNIQUE,
   body TEXT NOT NULL,created_at INTEGER NOT NULL,next_attempt_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,delivered_at INTEGER,last_error TEXT
 );
 CREATE INDEX IF NOT EXISTS idx_bj_due ON bj_notices(delivered_at,next_attempt_at,id);
 `);}
export function createBlackjack({db,pvp=null,clock=()=>Date.now(),rng=randomInt}={}){
 const room=id=>id&&/^[A-F0-9]{8}$/.test(id)?db.prepare('SELECT * FROM bj_rooms WHERE id=?').get(id):null;
 const seats=id=>db.prepare('SELECT * FROM bj_seats WHERE room_id=? ORDER BY joined_at,user_id').all(id);
 const activeRoom=user=>db.prepare("SELECT r.* FROM bj_rooms r JOIN bj_seats s ON s.room_id=r.id WHERE s.user_id=? AND r.status IN ('LOBBY','ACTIVE') ORDER BY r.created_at DESC LIMIT 1").get(user);
 const lastRoom=user=>db.prepare('SELECT r.* FROM bj_rooms r JOIN bj_seats s ON s.room_id=r.id WHERE s.user_id=? ORDER BY r.created_at DESC LIMIT 1').get(user);
 const groups=group=>db.prepare("SELECT * FROM bj_rooms WHERE group_jid=? AND status IN ('LOBBY','ACTIVE') ORDER BY created_at DESC LIMIT 1").get(group);
 function notice(r,to,key,body,now){if(to && (isPrivateJid(to)||to.endsWith('@g.us')))
   db.prepare('INSERT OR IGNORE INTO bj_notices(room_id,recipient,event_key,body,created_at,next_attempt_at) VALUES(?,?,?,?,?,?)').run(r.id,to,`${r.id}:${key}:${to}`,body,now,now);}
 const log=(r,actor,kind,detail,now)=>db.prepare('INSERT INTO bj_events(room_id,actor_id,kind,detail,created_at) VALUES(?,?,?,?,?)').run(r.id,actor,kind,JSON.stringify(detail),now);
 const labelCard=card=>card.replace(/S$/,'♠').replace(/H$/,'♥').replace(/D$/,'♦').replace(/C$/,'♣');
 const cards=hand=>hand.map(labelCard).join(' ') || '—';
 function summarize(r,user=null){const current=seats(r.id);const dealer=JSON.parse(r.dealer);
  const dealerShown=r.status==='ACTIVE'?`${dealer[0]?labelCard(dealer[0]):'?'} 🂠` :cards(dealer);
  const me=current.find(s=>s.user_id===user);
  const info=me?`\n🂡 Kartu Anda: ${cards(JSON.parse(me.hand))} (${evaluateHand(JSON.parse(me.hand)).total}) • ${me.state}${me.result?` • ${me.result}`:''}`:'';
  return `🃏 BLACKJACK ${r.id} — ${r.status} • ${pvp?.modeForMatch('blackjack',r.id).toUpperCase()??'CASUAL'}\nPemain: ${current.length}/${BJ_MAX_SEATS}\nDealer: ${dealerShown}${r.status==='ACTIVE'?' (kartu tertutup)':''}${info}\n${r.status==='LOBBY'?'.bj join '+r.id+' | .bj start':r.status==='ACTIVE'?'.bj hand | .bj hit | .bj stand':'.bj create untuk meja baru'}\nGratis, tanpa taruhan, dan tanpa transfer V-Currency.`;
 }
 function expire(now){for(const r of db.prepare("SELECT * FROM bj_rooms WHERE status IN ('LOBBY','ACTIVE') AND expires_at<=?").all(now)){
    db.prepare("UPDATE bj_rooms SET status='EXPIRED',updated_at=? WHERE id=?").run(now,r.id);
    for(const s of seats(r.id))notice(r,s.user_id,'expired',`⌛ Blackjack ${r.id} kedaluwarsa. Tidak ada perubahan saldo. Mulai baru: .bj create`,now);
    if(r.group_jid)notice(r,r.group_jid,'expired-group',`⌛ Meja blackjack ${r.id} ditutup karena tidak aktif.`,now);
   }
   db.prepare('DELETE FROM bj_notices WHERE delivered_at IS NOT NULL AND delivered_at<?').run(now-30*86400000);
 }
 function create(user,now,group=null){
   if(group){const existing=groups(group);if(existing)return `Meja grup masih aktif: ${existing.id}\n.bj board ${existing.id}`;}
   else if(activeRoom(user))return `Selesaikan meja ${activeRoom(user).id} dahulu: .bj status`;
   const r={id:nowId(),group_jid:group,status:'LOBBY'};
   db.prepare("INSERT INTO bj_rooms(id,group_jid,host_id,status,created_at,updated_at,expires_at) VALUES(?,?,?,'LOBBY',?,?,?)")
    .run(r.id,group,group?null:user,now,now,now+ROOM_TTL);
   pvp?.register('blackjack',r.id,pvp.currentMode(user,'blackjack'),now);
   if(!group)db.prepare('INSERT INTO bj_seats(room_id,user_id,joined_at) VALUES(?,?,?)').run(r.id,user,now);
   return group?`🃏 MEJA BLACKJACK GRUP ${r.id}\nPemain: buka chat pribadi bot dan ketik .bj join ${r.id}\nKartu pribadi TIDAK ditampilkan di grup.\nGunakan .bj board ${r.id} untuk progres publik.`:`🃏 Meja privat ${r.id} dibuat.\nUndang teman: .bj join ${r.id}\nMulai: .bj start (1–4 orang).`;
 }
 function finish(r,now){
   const remaining=JSON.parse(db.prepare('SELECT shoe FROM bj_rooms WHERE id=?').get(r.id).shoe);
   let dealer=JSON.parse(db.prepare('SELECT dealer FROM bj_rooms WHERE id=?').get(r.id).dealer);
   const roster=seats(r.id);
   if(roster.every(s=>['STAND','BUST','BLACKJACK'].includes(s.state))){
    if(roster.some(s=>s.state!=='BUST') && !evaluateHand(dealer).blackjack){while(evaluateHand(dealer).total<17){const c=remaining.pop();if(!c)throw Error('Shoe depleted');dealer.push(c);}}
    const dt=evaluateHand(dealer).total,dbust=dt>21,dblack=evaluateHand(dealer).blackjack;
    for(const s of roster){const hs=JSON.parse(s.hand),score=evaluateHand(hs);
      const result=score.bust?'LOSE':score.blackjack&&!dblack?'BLACKJACK':dblack&&!score.blackjack?'LOSE':dbust||score.total>dt?'WIN':score.total<dt?'LOSE':'PUSH';
      db.prepare('UPDATE bj_seats SET result=? WHERE room_id=? AND user_id=?').run(result,r.id,s.user_id);
      pvp?.recordBlackjack({id:r.id,user:s.user_id,result,now});
      notice(r,s.user_id,'finished',`🏁 Blackjack ${r.id} selesai!\nAnda: ${cards(hs)} = ${score.total} • ${result}\nDealer: ${cards(dealer)} = ${dt}\nTidak ada taruhan atau hadiah bernilai uang.`,now);
    }
    db.prepare("UPDATE bj_rooms SET status='DONE',shoe=?,dealer=?,updated_at=?,expires_at=? WHERE id=?")
      .run(JSON.stringify(remaining),JSON.stringify(dealer),now,now,r.id);
    if(r.group_jid)notice(r,r.group_jid,'group-finished',`🏁 Blackjack ${r.id} selesai! Dealer: ${cards(dealer)} (${dt}). Hasil privat terkirim ke peserta; tidak ada taruhan.`,now);
    log(r,null,'finish',{dealer,points:dt},now);return true;
   }return false;
 }
 function start(r,user,now){
   if(r.status!=='LOBBY')return `Meja sudah ${r.status}.`;
   if(r.host_id!==user)return 'Hanya host meja yang boleh memulai.';
   const roster=seats(r.id);if(roster.length<1)return 'Belum ada pemain. Gunakan .bj join CODE lewat DM.';
   const shoe=makeShoe(rng);const draw=()=>{const c=shoe.pop();if(!c)throw Error('Shoe depleted');return c;};
   const hands=roster.map(()=>[draw(),draw()]);const dealer=[draw(),draw()];
   db.prepare("UPDATE bj_rooms SET status='ACTIVE',shoe=?,dealer=?,updated_at=?,expires_at=? WHERE id=?").run(JSON.stringify(shoe),JSON.stringify(dealer),now,now+GAME_TTL,r.id);
   for(let i=0;i<roster.length;i++){
     const score=evaluateHand(hands[i]),state=score.blackjack?'BLACKJACK':'PLAY';
     db.prepare('UPDATE bj_seats SET hand=?,state=? WHERE room_id=? AND user_id=?').run(JSON.stringify(hands[i]),state,r.id,roster[i].user_id);
     notice(r,roster[i].user_id,'start',`🃏 Blackjack ${r.id} dimulai!\nKartu Anda: ${cards(hands[i])} (${score.total})${score.blackjack?' BLACKJACK!':''}\nDealer terlihat: ${labelCard(dealer[0])} 🂠\n${score.blackjack?'Tunggu hasil dealer.':'.bj hit | .bj stand | .bj hand'}`,now);
   }
   if(r.group_jid)notice(r,r.group_jid,'group-start',`🃏 Blackjack ${r.id} dimulai (${roster.length} pemain). Dealer memperlihatkan ${labelCard(dealer[0])} dan 1 kartu tertutup. Semua kartu peserta dan aksi Hit/Stand hanya melalui DM.`,now);
   log(r,user,'start',{players:roster.length},now);
   finish(r,now);
   return `✅ Blackjack ${r.id} dimulai. Kartu privat dikirim melalui DM. Ketik .bj hand untuk melihat kartu.`;
 }
 function perform(user,text,now=clock(),context={}){
   if(!/^\.(bj|blackjack)(\s|$)/i.test(text))return null;
   expire(now);
   const bits=text.trim().split(/\s+/),sub=(bits[1]??'help').toLowerCase(),id=(bits[2]??'').toUpperCase();
   const inGroup=context.isGroup===true,chatId=context.chatId??null;
   if(inGroup){
     if(sub==='group')return create(user,now,chatId);
     if(sub==='board' || sub==='status'){const r=room(id)||groups(chatId);return !r||r.group_jid!==chatId?'Meja grup tidak ditemukan. .bj group':`🃏 BLACKJACK ${r.id} • ${r.status}\nPemain: ${seats(r.id).length}/${BJ_MAX_SEATS}\nDealer: ${r.status==='ACTIVE'?labelCard(JSON.parse(r.dealer)[0])+' 🂠':r.status==='DONE'?cards(JSON.parse(r.dealer)):'Belum dibagikan'}\nPrivat: .bj join ${r.id} lewat DM bot.`;}
     return '🔒 Di grup: .bj group / .bj board CODE. Join, kartu dan Hit/Stand hanya di DM bot.';
   }
   if(sub==='help'||sub==='menu')return '🃏 BLACKJACK MULTIPLAYER (tanpa taruhan)\n.bj create — meja DM\n.bj join KODE — gabung dari DM\n.bj start — host memulai\n.bj hand | hit | stand — kartu dan giliran sendiri\n.bj status | leave — status atau keluar lobby\nGrup: .bj group lalu semua pemain .bj join KODE via DM.\nGratis, tidak ada V-Currency dan cash-out.';
   if(sub==='create')return create(user,now);
   if(sub==='join'){
     const r=room(id);if(!r||r.status!=='LOBBY'||r.expires_at<now)return 'Kode meja tidak ditemukan/kedaluwarsa. Minta kode baru dari host.';
     const existing=activeRoom(user);if(existing&&existing.id!==r.id)return `Anda masih di meja ${existing.id}. Keluar dari lobby lama dahulu.`;
     if(seats(r.id).some(s=>s.user_id===user))return `Anda sudah di meja ${r.id}. .bj status`;
     if(seats(r.id).length>=BJ_MAX_SEATS)return 'Meja penuh (maksimal 4 pemain).';
     db.prepare('INSERT INTO bj_seats(room_id,user_id,joined_at) VALUES(?,?,?)').run(r.id,user,now);
     if(!r.host_id)db.prepare('UPDATE bj_rooms SET host_id=? WHERE id=?').run(user,r.id);
     db.prepare('UPDATE bj_rooms SET updated_at=?,expires_at=? WHERE id=?').run(now,now+ROOM_TTL,r.id);
     log(r,user,'join',{},now);
     return `✅ Masuk blackjack ${r.id} • ${seats(r.id).length}/${BJ_MAX_SEATS} pemain. ${!r.host_id?'Anda host. ':''}Tunggu host .bj start.`;
   }
   const r=room(id) ?? activeRoom(user) ?? lastRoom(user);
   if(!r)return 'Belum masuk meja. .bj create atau .bj join KODE';
   const seat=seats(r.id).find(s=>s.user_id===user);
   if(!seat)return 'Meja tidak ditemukan atau Anda bukan peserta.';
   if(sub==='status'||sub==='hand')return summarize(r,user);
   if(sub==='start')return start(r,user,now);
   if(sub==='leave'){
     if(r.status!=='LOBBY')return 'Tidak bisa keluar di tengah ronde. Gunakan .bj stand (atau biarkan waktu game habis).';
     db.prepare('DELETE FROM bj_seats WHERE room_id=? AND user_id=?').run(r.id,user);
     if(user===r.host_id){const next=seats(r.id)[0];if(next)db.prepare('UPDATE bj_rooms SET host_id=? WHERE id=?').run(next.user_id,r.id);else db.prepare("UPDATE bj_rooms SET host_id=NULL,status='CANCELLED',updated_at=? WHERE id=?").run(now,r.id);}
     return '🚪 Anda keluar dari lobby blackjack.';
   }
   if(!['hit','stand'].includes(sub))return 'Gunakan .bj help | create | join KODE | start | hand | hit | stand | status | leave';
   if(r.status!=='ACTIVE')return `Ronde tidak aktif (${r.status}).`;
   if(seat.state!=='PLAY')return `Tangan Anda sudah ${seat.state}. ${summarize(r,user)}`;
   if(sub==='stand'){
     db.prepare("UPDATE bj_seats SET state='STAND' WHERE room_id=? AND user_id=?").run(r.id,user);
     log(r,user,'stand',{},now);finish(r,now);return `✋ Stand di ${r.id}. ${summarize(room(r.id),user)}`;
   }
   const shoe=JSON.parse(r.shoe),card=shoe.pop();if(!card)throw Error('Shoe depleted');
   const hand=JSON.parse(seat.hand);hand.push(card);const score=evaluateHand(hand);
   const state=score.bust?'BUST':score.total===21?'STAND':'PLAY';
   db.prepare('UPDATE bj_rooms SET shoe=?,updated_at=?,expires_at=? WHERE id=?').run(JSON.stringify(shoe),now,now+GAME_TTL,r.id);
   db.prepare('UPDATE bj_seats SET hand=?,state=? WHERE room_id=? AND user_id=?').run(JSON.stringify(hand),state,r.id,user);
   log(r,user,'hit',{card,score:score.total},now);finish(r,now);
   return `🂡 Anda mendapat ${labelCard(card)}. ${summarize(room(r.id),user)}`;
 }
 function notices(now=clock(),limit=12){expire(now);const found=db.prepare('SELECT * FROM bj_notices WHERE delivered_at IS NULL AND next_attempt_at<=? AND attempts<6 ORDER BY id LIMIT ?').all(now,Math.max(1,Math.min(12,limit)));
   for(const n of found)db.prepare('UPDATE bj_notices SET attempts=attempts+1,next_attempt_at=? WHERE id=? AND delivered_at IS NULL').run(now+45000,n.id);return found;
 }
 const ack=(id,now=clock())=>db.prepare('UPDATE bj_notices SET delivered_at=?,last_error=NULL WHERE id=? AND delivered_at IS NULL').run(now,id);
 function fail(id,error,now=clock()){const n=db.prepare('SELECT attempts FROM bj_notices WHERE id=?').get(id);db.prepare('UPDATE bj_notices SET next_attempt_at=?,last_error=? WHERE id=? AND delivered_at IS NULL').run(now+Math.min(600000,30000*2**Math.max(0,(n?.attempts??1)-1)),String(error).slice(0,150),id);}
 function image(user){const r=activeRoom(user)??lastRoom(user);if(!r)return null;
   const s=seats(r.id).find(s=>s.user_id===user);if(!s)return null;
   const hand=JSON.parse(s.hand),dealer=JSON.parse(r.dealer);
   if(hand.length===0)return null;
   return {png:renderBlackjackCards({hand,dealer,reveal:r.status==='DONE'}),caption:`🃏 Blackjack ${r.id} • ${r.status}\nKartu Anda: ${cards(hand)} (${evaluateHand(hand).total})\n${r.status==='ACTIVE'?'Dealer menutup kartu keduanya. .bj hit | .bj stand':'.bj status untuk hasil lengkap'}`};
 }
 const stats=()=>({active:db.prepare("SELECT COUNT(*) n FROM bj_rooms WHERE status='ACTIVE'").get().n,lobbies:db.prepare("SELECT COUNT(*) n FROM bj_rooms WHERE status='LOBBY'").get().n,done:db.prepare("SELECT COUNT(*) n FROM bj_rooms WHERE status='DONE'").get().n});
 return {perform,notices,ack,fail,stats,image,context:(u)=>({phase:activeRoom(u)?.status??'IDLE'})};
}
