/** v1.2 Chess Arena. Explicit opt-in; only rated completed matches with sufficient play. */
import {randomBytes} from 'node:crypto';
import {initialChess,moveChess,fen} from './chess/engine.js';
import {createIntelligence} from './intelligence.js';
import {renderChessBoard} from './chess/board-png.js';
const ACCEPT_MS=5*60_000,QUEUE_MS=5*60_000,TURN_MS=24*60*60_000;
const id=()=>randomBytes(5).toString('hex').toUpperCase();
export function initChess(db){db.exec(`
 CREATE TABLE IF NOT EXISTS chess_queue (user_id TEXT PRIMARY KEY REFERENCES users(id),queued_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS chess_matches (id TEXT PRIMARY KEY,white_id TEXT NOT NULL REFERENCES users(id),black_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL CHECK(status IN ('PENDING','ACTIVE','DONE','CANCELLED','EXPIRED')),accepted TEXT NOT NULL,state TEXT NOT NULL,ply INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,finished_at INTEGER, CHECK(white_id<>black_id));
 CREATE INDEX IF NOT EXISTS idx_chess_w ON chess_matches(white_id,status);
 CREATE INDEX IF NOT EXISTS idx_chess_b ON chess_matches(black_id,status);
 CREATE TABLE IF NOT EXISTS chess_move_log (match_id TEXT NOT NULL REFERENCES chess_matches(id),ply INTEGER NOT NULL,player_id TEXT NOT NULL REFERENCES users(id),uci TEXT NOT NULL,fen TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(match_id,ply));
 CREATE TABLE IF NOT EXISTS chess_ratings (user_id TEXT PRIMARY KEY REFERENCES users(id),rating INTEGER NOT NULL DEFAULT 1200,played INTEGER NOT NULL DEFAULT 0,wins INTEGER NOT NULL DEFAULT 0,draws INTEGER NOT NULL DEFAULT 0,losses INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS chess_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, recipient TEXT NOT NULL REFERENCES users(id), match_id TEXT NOT NULL REFERENCES chess_matches(id),
  event_type TEXT NOT NULL, body TEXT NOT NULL, show_board INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, next_attempt_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  delivered_at INTEGER, last_error TEXT,
  UNIQUE(match_id,recipient,event_type,created_at)
 );
 CREATE INDEX IF NOT EXISTS idx_chess_notice_due ON chess_notifications(delivered_at,next_attempt_at,id);
 `);}
export function createChess({db,clock=()=>Date.now(),intelligence=createIntelligence({db}),pvp=null}){
 const candidate=u=>db.prepare("SELECT * FROM chess_matches WHERE (white_id=? OR black_id=?) AND status IN ('PENDING','ACTIVE') ORDER BY created_at DESC LIMIT 1").get(u,u);
 const latest=u=>db.prepare('SELECT * FROM chess_matches WHERE white_id=? OR black_id=? ORDER BY created_at DESC LIMIT 1').get(u,u);
 const ensureRating=u=>db.prepare('INSERT OR IGNORE INTO chess_ratings(user_id) VALUES(?)').run(u);
 const rating=u=>{ensureRating(u);return db.prepare('SELECT * FROM chess_ratings WHERE user_id=?').get(u);};
 const queueCount=()=>db.prepare('SELECT COUNT(*) n FROM chess_queue').get().n;
 function notify(m,recipient,eventType,body,now,showBoard=false){
  // Enqueued in the same transaction as the match update; repeated inbound IDs do not double-notify.
  db.prepare('INSERT OR IGNORE INTO chess_notifications(recipient,match_id,event_type,body,show_board,created_at,next_attempt_at) VALUES(?,?,?,?,?,?,?)')
    .run(recipient,m.id,eventType,body,showBoard?1:0,now,now);
 }
 function both(m,eventType,text,now,showBoard=false){
  for(const recipient of [m.white_id,m.black_id])notify(m,recipient,eventType,text,now,showBoard);
 }
 function tick(now){
  db.prepare('DELETE FROM chess_queue WHERE expires_at<=?').run(now);
  const expired=db.prepare("SELECT * FROM chess_matches WHERE status IN ('PENDING','ACTIVE') AND expires_at<=?").all(now);
  for(const m of expired){
    db.prepare("UPDATE chess_matches SET status='EXPIRED',finished_at=? WHERE id=? AND status IN ('PENDING','ACTIVE')").run(now,m.id);
    both(m,'expired',`⌛ Pertandingan catur ${m.id} berakhir karena batas waktu. Tidak ada pemenang/rating dari timeout ini. .chess join untuk mencari pertandingan baru.`,now);
  }
  db.prepare('DELETE FROM chess_notifications WHERE delivered_at IS NOT NULL AND delivered_at<?').run(now-30*86400000);
 }
 function lookup(u,matchId){const m=matchId?db.prepare('SELECT * FROM chess_matches WHERE id=?').get(matchId):candidate(u)??latest(u);return m&&(m.white_id===u||m.black_id===u)?m:null;}
 function persist(m){db.prepare('UPDATE chess_matches SET status=?,accepted=?,state=?,ply=?,expires_at=?,finished_at=? WHERE id=?').run(m.status,m.accepted,m.state,m.ply,m.expires_at,m.finished_at??null,m.id);}
 function updateRating(m,winner){if(m.ply<8 || (pvp&&pvp.modeForMatch('chess',m.id)!=='ranked'))return false;const white=rating(m.white_id),black=rating(m.black_id);const eW=1/(1+10**((black.rating-white.rating)/400)),aW=winner==='w'?1:winner==='b'?0:0.5;
 const nw=Math.max(100,white.rating+Math.round(24*(aW-eW))),nb=Math.max(100,black.rating+Math.round(24*((1-aW)-(1-eW))));
 const upd=db.prepare('UPDATE chess_ratings SET rating=?,played=played+1,wins=wins+?,draws=draws+?,losses=losses+? WHERE user_id=?');upd.run(nw,Number(aW===1),Number(aW===0.5),Number(aW===0),m.white_id);upd.run(nb,Number(aW===0),Number(aW===0.5),Number(aW===1),m.black_id);return true;}
 function summarize(m,u){
  const s=JSON.parse(m.state), c=m.white_id===u?'w':'b', isTurn=s.turn===c;
  const accepted=JSON.parse(m.accepted),status=m.status==='PENDING'?'Menunggu kedua pemain menerima':m.status==='ACTIVE'?(isTurn?'🟢 GILIRAN ANDA':'⏳ Menunggu langkah lawan'):'🏁 Match selesai';
  const result=s.result?`\nHasil: ${s.result.type}${s.result.winner?` • ${s.result.winner===c?'ANDA MENANG':'ANDA KALAH'}`:''}`:'';
  const controls=m.status==='PENDING'?`Konfirmasi ${accepted.length}/2 • .chess accept | .chess cancel`:m.status==='ACTIVE'?'Aksi: .chess move e2e4 | .chess board | .chess resign':'Main lagi: .chess join';
  return `♟️ CHESS ${m.id} (${m.status}) • ${pvp?.modeForMatch('chess',m.id).toUpperCase()??'RANKED'}\nKamu: ${c==='w'?'PUTIH':'HITAM'} • ${status}\nLangkah: ${m.ply} • ${s.last??'-'}${result}\n${controls}\nPapan: .chess board | Info: .chess lobby`;
}
 function perform(u,text,now=clock()){
  if(!/^\.chess(?:\s|$)/i.test(text))return null;
  tick(now);const args=text.trim().split(/\s+/),sub=(args[1]||'help').toLowerCase();
  if(['help','arena','menu'].includes(sub))return '♟️ CHESS ARENA (beta, non-taruhan)\n.chess join — antre sesuai mode .pvp\n.chess join casual|ranked — pilih mode dan antre\n.chess status — status\n.chess accept — terima match\n.chess move e2e4 — langkah UCI\n.chess board — gambar papan\n.chess rating — statistik\n.chess top — leaderboard opt-in\n.chess leave — keluar antrean\n.chess cancel — batalkan undangan\n.chess lobby — info pemain antre & match\n.chess resign — menyerah';
  if(sub==='lobby'){const counts=stats();return `♟️ LOBBY CATUR\n🟡 Antre: ${counts.waiting} pemain\n🤝 Menunggu konfirmasi: ${counts.pending} match\n🟢 Sedang main: ${counts.active} match\n🏁 Match selesai: ${counts.completed}\n.chess join — cari lawan\n.chess status — cek match\n.chess leave — batalkan antrean`; }
  if(sub==='rating'){const r=rating(u);return `♟️ Rating ${r.rating}, match ${r.played} (W${r.wins}/D${r.draws}/L${r.losses}). Partai selesai minimal 8 ply untuk memengaruhi rating.`;}
  if(sub==='top'){const rows=db.prepare('SELECT c.rating,p.nickname,c.played FROM chess_ratings c JOIN player_stats p ON p.user_id=c.user_id WHERE p.ranked=1 AND p.nickname IS NOT NULL ORDER BY c.rating DESC LIMIT 10').all();return rows.length?'🏆 TOP CATUR (opt-in):\n'+rows.map((r,i)=>`${i+1}. ${r.nickname}: ${r.rating} (${r.played})`).join('\n'):'Belum ada pemain yang memilih tampil di ranking (.rank join, .nick NAMA).';}
  if(sub==='leave'){db.prepare('DELETE FROM chess_queue WHERE user_id=?').run(u);return '✅ Keluar antrean catur. Anda tidak akan dipasangkan lagi sampai .chess join.';}
  if(sub==='cancel'){
    const m=candidate(u);
    if(!m){db.prepare('DELETE FROM chess_queue WHERE user_id=?').run(u);return '✅ Antrean dibatalkan (jika ada).';}
    if(m.status==='ACTIVE')return 'Pertandingan sedang berlangsung; gunakan .chess resign untuk menyerah (tidak otomatis).';
    m.status='CANCELLED';m.finished_at=now;persist(m);
    const other=m.white_id===u?m.black_id:m.white_id;
    notify(m,other,'cancel',`🚫 Undangan catur ${m.id} dibatalkan oleh lawan. Anda dapat mencari match baru dengan .chess join.`,now);
    return '✅ Undangan pertandingan dibatalkan. Lawan akan diberitahu.';
  }
  if(sub==='status'||sub==='current'){
    const m=lookup(u,args[2]?.toUpperCase());if(m)return summarize(m,u);
    const q=db.prepare('SELECT queued_at,expires_at FROM chess_queue WHERE user_id=?').get(u);
    return q?`⏳ Sedang mencari lawan. Pemain siap dalam antrean: ${queueCount()}.\nAntrean berakhir dalam ${Math.max(0,Math.ceil((q.expires_at-now)/60000))} menit.\nKeluar: .chess leave | Lihat lobby: .chess lobby`:'Tidak ada match catur. Gunakan .chess join';
  }
  if(sub==='join'){
   if(candidate(u))return 'Masih memiliki match catur pending/aktif. Gunakan .chess status';
   const chosen=(args[2]||'').toLowerCase();
   if(chosen && chosen!=='ranked' && chosen!=='casual')return 'Pilih .chess join ranked atau .chess join casual';
   if(chosen&&pvp){const change=pvp.setMode(u,'chess',chosen);if(!change.startsWith('✅'))return change;}
   const matchMode=pvp?.currentMode(u,'chess')??'ranked';
   ensureRating(u);db.prepare('INSERT INTO chess_queue(user_id,queued_at,expires_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET expires_at=excluded.expires_at').run(u,now,now+QUEUE_MS);
   const mine=rating(u);const eligible=db.prepare('SELECT q.user_id,r.rating,q.queued_at FROM chess_queue q JOIN chess_ratings r ON r.user_id=q.user_id WHERE q.user_id<>? ORDER BY q.queued_at,q.user_id').all(u).filter(x=>(!pvp||pvp.currentMode(x.user_id,'chess')===matchMode)&&Math.abs(x.rating-mine.rating)<=200+Math.floor(Math.max(0,now-x.queued_at)/60000)*25&&!candidate(x.user_id));
   // Elo remains the default. With a qualified local ML model, prioritize fairer match odds
   // without overriding ready consent or the expanding queue-rating bounds.
   const opponent=intelligence.isModelActive ? eligible.sort((a,b)=>{
     const sa=Math.abs(intelligence.predict(a.rating,mine.rating)-0.5)-Math.min(0.12,Math.max(0,now-a.queued_at)/6000000);
     const sb=Math.abs(intelligence.predict(b.rating,mine.rating)-0.5)-Math.min(0.12,Math.max(0,now-b.queued_at)/6000000);
     return sa-sb||a.queued_at-b.queued_at;
   })[0] : eligible[0];
   if(!opponent)return `✅ Masuk antre catur (5 menit).\n⏳ MENUNGGU LAWAN... (${queueCount()} pemain mengantre)\nRating: ${mine.rating} (jangkauan awal ±200).\n🔎 .chess status | 🚪 .chess leave | 👥 .chess lobby`;
   const matchId=id();pvp?.register('chess',matchId,matchMode,now);db.prepare('DELETE FROM chess_queue WHERE user_id IN (?,?)').run(u,opponent.user_id);
   db.prepare('INSERT INTO chess_matches(id,white_id,black_id,status,accepted,state,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').run(matchId,opponent.user_id,u,'PENDING','[]',JSON.stringify(initialChess()),now,now+ACCEPT_MS);
   if(matchMode==='ranked')intelligence.snapshot({matchId,whiteId:opponent.user_id,blackId:u,whiteRating:opponent.rating,blackRating:mine.rating,now});
   const found=db.prepare('SELECT * FROM chess_matches WHERE id=?').get(matchId);
   both(found,'match-found',`🎯 LAWAN DITEMUKAN!\n♟️ Chess ${matchId} • ${matchMode.toUpperCase()}\nPutih: rating ${opponent.rating} • Hitam: rating ${mine.rating}\nKedua pemain harus menyetujui dalam 5 menit.\n✅ .chess accept | ❌ .chess cancel | 🔎 .chess status`,now);
   return `♟️ MATCH FOUND ${matchId}! Kedua pemain konfirmasi .chess accept dalam 5 menit. Calon lawan akan menerima pemberitahuan.`;
  }
  const m=lookup(u,args[3]?.toUpperCase());if(!m)return 'Match catur tidak ditemukan atau bukan milikmu. .chess status';
  if(sub==='board')return summarize(m,u);
  if(sub==='accept'){
    if(m.status!=='PENDING')return `Status: ${m.status}`;
    const a=JSON.parse(m.accepted),first=!a.includes(u);if(first)a.push(u);m.accepted=JSON.stringify(a);
    if(a.includes(m.white_id)&&a.includes(m.black_id)){m.status='ACTIVE';m.expires_at=now+TURN_MS;}
    persist(m);
    if(m.status==='ACTIVE' && first){
      notify(m,m.white_id,'started-white',`🟢 CHESS DIMULAI! (${m.id})\nAnda PUTIH dan mendapat giliran pertama. Gambar papan dilampirkan.\nKetik .chess move e2e4 atau .chess board.`,now,true);
      notify(m,m.black_id,'started-black',`♟️ CHESS DIMULAI! (${m.id})\nAnda HITAM. ⏳ Tunggu langkah pertama PUTIH.\n.chess status | .chess board`,now,true);
    } else if(first){const other=m.white_id===u?m.black_id:m.white_id;notify(m,other,'opponent-accepted',`✅ Lawan telah menerima undangan ${m.id}. Silakan balas .chess accept sebelum batas 5 menit.`,now);}
    return m.status==='ACTIVE'?'♟️ MATCH DIMULAI! Putih pertama. .chess board | .chess move e2e4':'✅ Diterima. Menunggu konfirmasi lawan.';
  }
  if(sub==='resign'){if(!['ACTIVE','PENDING'].includes(m.status))return `Status: ${m.status}`;if(m.status==='PENDING'){m.status='CANCELLED';m.finished_at=now;persist(m);notify(m,m.white_id===u?m.black_id:m.white_id,'cancel-resign',`🚫 Undangan catur ${m.id} dibatalkan.`,now);return 'Undangan catur dibatalkan.';}
   m.status='DONE';m.finished_at=now;const s=JSON.parse(m.state);s.result={type:'RESIGN',winner:m.white_id===u?'b':'w'};m.state=JSON.stringify(s);const rated=updateRating(m,s.result.winner);if(pvp?.modeForMatch('chess',m.id)==='ranked')intelligence.finish(m.id,m.ply>=8?s.result.winner:null,now);persist(m);
   // Resignation is deliberately ineligible for currency rewards (anti-win-trading).
   pvp?.settle({game:'chess',id:m.id,players:[m.white_id,m.black_id],winner:s.result.winner==='w'?m.white_id:m.black_id,completed:true,eligible:false,now});
   notify(m,m.white_id===u?m.black_id:m.white_id,'winner-resign',`🏆 ANDA MENANG!\nLawan menyerah pada pertandingan ${m.id}. ${rated?'Rating diperbarui.':'Rating tidak berubah (kurang dari 8 ply).'}\nMain lagi: .chess join`,now,true);
   return `🏳️ Menyerah. Lawan menang.${rated?' Rating diperbarui.':' Rating tidak berubah (Casual atau partai terlalu singkat).'} Tidak ada reward V dari resign.`;}
  if(sub==='move'){
   if(m.status!=='ACTIVE')return `Pertandingan belum aktif (${m.status}).`;
   const move=(args[2]||'').toLowerCase();const s=JSON.parse(m.state),side=m.white_id===u?'w':'b';if(side!==s.turn)return '⏳ Belum giliranmu.';
   try{const next=moveChess(s,move);m.state=JSON.stringify(next);m.ply++;m.expires_at=now+TURN_MS;
    db.prepare('INSERT INTO chess_move_log(match_id,ply,player_id,uci,fen,created_at) VALUES(?,?,?,?,?,?)').run(m.id,m.ply,u,next.last,fen(next),now);
    let rated=false;if(next.result){m.status='DONE';m.finished_at=now;rated=updateRating(m,next.result.winner);if(m.ply>=8 && pvp?.modeForMatch('chess',m.id)==='ranked')intelligence.finish(m.id,next.result.winner??'draw',now);}persist(m);
    let pvpPayout={};
    if(next.result){const winner=next.result.winner==='w'?m.white_id:next.result.winner==='b'?m.black_id:null;
      pvpPayout=pvp?.settle({game:'chess',id:m.id,players:[m.white_id,m.black_id],winner,completed:true,eligible:!!winner&&m.ply>=8&&next.result.type!=='RESIGN',now})??{};}
    if(next.result){for(const recipient of [m.white_id,m.black_id]){const color=recipient===m.white_id?'w':'b';const verdict=next.result.winner?(next.result.winner===color?'🏆 ANDA MENANG':'💔 Anda kalah'):'🤝 SERI';notify(m,recipient,`final-${m.ply}`,`${verdict}! Chess ${m.id} selesai (${next.result.type}). ${rated?'Rating diperbarui.':'Rating tidak berubah.'}${pvpPayout[recipient]?` 🎁 +${pvpPayout[recipient]} V Ranked!`:''}\nMain lagi: .chess join`,now,true);}}
    else {const nextUser=next.turn==='w'?m.white_id:m.black_id;notify(m,nextUser,`turn-${m.ply}`,`♟️ GILIRAN ANDA! Chess ${m.id}\nLangkah lawan: ${next.last} (${m.ply} ply)\nPapan terbaru dilampirkan.\nMain: .chess move e7e5 (contoh) | Info: .chess status | Menyerah: .chess resign`,now,true);}
    return `♟️ ${next.last} | ${m.ply} ply${next.result?`\n🏁 ${next.result.type}${next.result.winner?' (menang '+(next.result.winner==='w'?'Putih':'Hitam')+')':''}${rated?' | Rating diperbarui':''}`:''}\nLihat papan: .chess board`;
   }catch(e){return `⛔ ${e.message}`;}
  }
  return 'Gunakan .chess help | join | status | accept | move e2e4 | board | rating | top | leave | resign';
 }
 function getBoard(u,provided){
  const m=lookup(u,provided?String(provided).toUpperCase():null);if(!m)return null;
  const s=JSON.parse(m.state),side=m.white_id===u?'w':'b',yourTurn=s.turn===side;
  const situation=m.status==='ACTIVE'?(yourTurn?'🟢 Giliran Anda':'⏳ Menunggu lawan'):m.status==='PENDING'?'Menunggu konfirmasi':`🏁 ${m.status}`;
  const controls=m.status==='ACTIVE'?'Main: .chess move e2e4 (contoh) | .chess resign':m.status==='PENDING'?'.chess accept | .chess cancel':'.chess join';
  return {png:renderChessBoard(s),caption:`♟️ Catur ${m.id} • ${m.status}\n${s.last?'Langkah terakhir: '+s.last:'Posisi awal'}\n${situation} (${s.turn==='w'?'Putih':'Hitam'} jalan)\n${controls}\nStatus: .chess status`,filename:`chess-${m.id}.png`};
}
 function stats(){const get=(q)=>db.prepare(q).get().n;return {waiting:get('SELECT COUNT(*) n FROM chess_queue'),pending:get("SELECT COUNT(*) n FROM chess_matches WHERE status='PENDING'"),active:get("SELECT COUNT(*) n FROM chess_matches WHERE status='ACTIVE'"),completed:get("SELECT COUNT(*) n FROM chess_matches WHERE status='DONE'")};}
 function context(u){const m=candidate(u);if(m)return {phase:m.status,matchId:m.id};if(db.prepare('SELECT 1 FROM chess_queue WHERE user_id=?').get(u))return {phase:'WAITING'};return {phase:'IDLE'};}
 function claimNotifications(now=clock(),limit=12){
  tick(now);
  const pending=db.prepare('SELECT * FROM chess_notifications WHERE delivered_at IS NULL AND next_attempt_at<=? AND attempts<5 ORDER BY id LIMIT ?').all(now,Math.max(1,Math.min(12,limit)));
  for(const n of pending){db.prepare('UPDATE chess_notifications SET attempts=attempts+1,next_attempt_at=? WHERE id=? AND delivered_at IS NULL').run(now+45000,n.id);}
  return pending;
 }
 function ackNotification(noticeId,at=clock()){db.prepare('UPDATE chess_notifications SET delivered_at=?,last_error=NULL WHERE id=? AND delivered_at IS NULL').run(at,noticeId);}
 function failNotification(noticeId,reason,at=clock()){
  const row=db.prepare('SELECT attempts FROM chess_notifications WHERE id=?').get(noticeId);
  const delay=Math.min(15*60000,30000*2**Math.max(0,(row?.attempts??1)-1));
  db.prepare('UPDATE chess_notifications SET next_attempt_at=?,last_error=? WHERE id=? AND delivered_at IS NULL').run(at+delay,String(reason??'delivery failed').slice(0,120),noticeId);
 }
 return {perform,getBoard,stats,context,tick,claimNotifications,ackNotification,failNotification};
}
