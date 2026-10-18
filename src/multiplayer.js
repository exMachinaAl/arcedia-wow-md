/** WA-WORLD multiplayer v1.1: voluntary DM queue, persistent match state, no wagering. */
import {randomBytes, randomInt} from 'node:crypto';
import {renderSnakeBoard} from './multiplayer/board-png.js';

const TTL=5*60_000, TURN_TTL=24*60*60_000;
const SNAKES=Object.freeze({17:7,54:34,62:19,87:24,98:79});
const LADDERS=Object.freeze({3:22,11:29,26:47,38:59,52:72,71:92});
const uid=()=>randomBytes(5).toString('hex').toUpperCase();
const minutes=t=>Math.max(0,Math.ceil(t/60000));
export const SN_LADDERS={snakes:SNAKES,ladders:LADDERS};

export function initMultiplayer(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS match_queue (
      user_id TEXT PRIMARY KEY REFERENCES users(id), game TEXT NOT NULL CHECK(game='snakes'),
      queued_at INTEGER NOT NULL,expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_match_queue_game ON match_queue(game,queued_at);
    CREATE TABLE IF NOT EXISTS world_matches (
      id TEXT PRIMARY KEY, game TEXT NOT NULL CHECK(game='snakes'),
      player_a TEXT NOT NULL REFERENCES users(id),player_b TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL CHECK(status IN ('PENDING','ACTIVE','DONE','EXPIRED','CANCELLED')),
      accepts TEXT NOT NULL, state TEXT NOT NULL, created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL, completed_at INTEGER,
      CHECK(player_a<>player_b)
    );
    CREATE INDEX IF NOT EXISTS idx_match_players_a ON world_matches(player_a,status);
    CREATE INDEX IF NOT EXISTS idx_match_players_b ON world_matches(player_b,status);
    CREATE TABLE IF NOT EXISTS world_match_events (
      match_id TEXT NOT NULL REFERENCES world_matches(id), turn_no INTEGER NOT NULL,
      actor TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, detail TEXT NOT NULL,
      created_at INTEGER NOT NULL, PRIMARY KEY(match_id,turn_no)
    );
  `);
}
export function createMultiplayer({db,draw=randomInt,pvp=null}) {
  const lookup=(id)=>db.prepare('SELECT * FROM world_matches WHERE id=?').get(id);
  const candidate=(user)=>db.prepare(`SELECT * FROM world_matches WHERE (player_a=? OR player_b=?) AND status IN ('PENDING','ACTIVE') ORDER BY created_at DESC LIMIT 1`).get(user,user);
  const latest=(user)=>db.prepare(`SELECT * FROM world_matches WHERE (player_a=? OR player_b=?) ORDER BY created_at DESC LIMIT 1`).get(user,user);
  const save=(m)=>db.prepare('UPDATE world_matches SET status=?,accepts=?,state=?,expires_at=?,completed_at=? WHERE id=?').run(m.status,m.accepts,m.state,m.expires_at,m.completed_at,m.id);
  function tick(now) {
    db.prepare('DELETE FROM match_queue WHERE expires_at<=?').run(now);
    db.prepare("UPDATE world_matches SET status='EXPIRED',completed_at=? WHERE status IN ('PENDING','ACTIVE') AND expires_at<=?").run(now,now);
  }
  function authorized(id,user) {
    const m=lookup(id);
    if(!m||![m.player_a,m.player_b].includes(user))return null;
    return m;
  }
  function resolveMatch(user,provided) {
    if(provided && !/^[0-9A-F]{10}$/.test(provided))return null;
    return provided?authorized(provided,user):candidate(user)??latest(user);
  }
  const names=(m)=>'P1/P2'; // Deliberately avoid exposing phone numbers in any response.
  function describe(m,user) {
    const state=JSON.parse(m.state);
    const me=user===m.player_a?0:1;
    const turn=state.turn===me?'GILIRANMU':'MENUNGGU LAWAN';
    return `🎲 Match ${m.id} (${m.status}) • ${pvp?.modeForMatch('snakes',m.id).toUpperCase()??'CASUAL'}\nP1: kotak ${state.positions[0]} · P2: kotak ${state.positions[1]}\nAnda: P${me+1} · ${turn}\n${m.status==='PENDING'?'Konfirmasi: .match accept '+m.id:m.status==='ACTIVE'?'Aksi: .match roll '+m.id:'Pertandingan selesai'}\nPapan: .match board ${m.id}`;
  }
  function perform(user,text,now=Date.now()) {
    if(!/^\.(arena|queue|match)(\s|$)/i.test(text))return null;
    tick(now);
    const [command,sub='',rawId='',requestedMode='']=text.trim().split(/\s+/);
    const id=rawId.toUpperCase();
    if(command==='.arena')return '🎮 WA-WORLD Arena (beta)\n🎲 Ular Tangga 2 pemain, tanpa taruhan.\n.queue join snakes — masuk matchmaking\n.queue status — lihat antrean\n.queue leave — keluar antrean\n.match current — pertandinganmu\n.match accept — terima pertandingan\n.match roll — lempar dadu\n.match board — kirim gambar papan\n.match resign — menyerah';
    if(command==='.queue') {
      if(sub==='leave'){db.prepare('DELETE FROM match_queue WHERE user_id=?').run(user);return '✅ Keluar dari antrean.';}
      if(sub==='status'){
        const m=candidate(user);if(m)return describe(m,user);
        const q=db.prepare('SELECT * FROM match_queue WHERE user_id=?').get(user);
        return q?`🕹️ Masih antre ular tangga. Masa tunggu ${minutes(q.expires_at-now)} menit. Keluar: .queue leave`:'Kamu belum antre. Gunakan .queue join snakes';
      }
      if(sub!=='join'||rawId.toLowerCase()!=='snakes')return 'Gunakan .queue join snakes | .queue status | .queue leave';
      if(requestedMode && !['ranked','casual'].includes(requestedMode))return 'Pilih .queue join snakes casual atau ranked';
      const existing=candidate(user);
      if(existing)return `Kamu sudah punya match aktif/pending.\n${describe(existing,user)}`;
      if(requestedMode&&pvp){const change=pvp.setMode(user,'snakes',requestedMode);if(!change.startsWith('✅'))return change;}
      const matchMode=pvp?.currentMode(user,'snakes')??'casual';
      db.prepare('INSERT INTO match_queue(user_id,game,queued_at,expires_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET game=excluded.game,expires_at=excluded.expires_at').run(user,'snakes',now,now+TTL);
      // FIFO queue, opt-in only. Friends, contacts, groups and arbitrary phone numbers are never scraped.
      const opponent=db.prepare("SELECT user_id FROM match_queue WHERE game='snakes' AND user_id<>? ORDER BY queued_at ASC,user_id ASC").all(user).find(x=>!pvp||pvp.currentMode(x.user_id,'snakes')===matchMode);
      if(!opponent)return '✅ Kamu masuk antrean Ular Tangga. Tunggu lawan lalu periksa .queue status. Masa antre 5 menit.';
      if(candidate(opponent.user_id)) { db.prepare('DELETE FROM match_queue WHERE user_id=?').run(opponent.user_id);return '✅ Kamu masuk antrean. Calon lawan sibuk; coba .queue status.'; }
      const matchId=uid();pvp?.register('snakes',matchId,matchMode,now);
      db.prepare('DELETE FROM match_queue WHERE user_id IN (?,?)').run(user,opponent.user_id);
      const start=JSON.stringify({positions:[0,0],turn:0,turnNo:0,lastRoll:null,winner:null});
      db.prepare('INSERT INTO world_matches(id,game,player_a,player_b,status,accepts,state,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(matchId,'snakes',opponent.user_id,user,'PENDING','[]',start,now,now+TTL);
      return `✅ MATCH FOUND! ID: ${matchId} • ${matchMode.toUpperCase()}\nDua pemain perlu menerima dalam 5 menit.\n.match accept ${matchId}\nLawan dapat memeriksa .match current. Tidak ada DM otomatis.`;
    }
    if(command!=='.match')return null;
    if(sub==='current') {const m=candidate(user)??latest(user);return m?describe(m,user):'Tidak ada match. Gunakan .queue join snakes';}
    const m=resolveMatch(user,id);
    if(!m)return 'Match tidak ditemukan atau bukan milikmu. Gunakan .match current';
    if(sub==='status'||sub==='board')return describe(m,user);
    if(sub==='accept') {
      if(m.status!=='PENDING')return `Status match: ${m.status}`;
      const accepted=JSON.parse(m.accepts);
      if(!accepted.includes(user))accepted.push(user);
      m.accepts=JSON.stringify(accepted);
      if(accepted.includes(m.player_a)&&accepted.includes(m.player_b)){m.status='ACTIVE';m.expires_at=now+TURN_TTL;}
      save(m);
      return m.status==='ACTIVE'?`🎮 MATCH ${m.id} DIMULAI! P1 lebih dulu.\n.match roll ${m.id}`:`✅ Konfirmasi diterima. Menunggu lawan.\n.match status ${m.id}`;
    }
    if(sub==='roll') {
      if(m.status!=='ACTIVE')return `Belum bisa main (status ${m.status}).`;
      const state=JSON.parse(m.state),me=user===m.player_a?0:1;
      if(me!==state.turn)return '⏳ Belum giliranmu. Periksa .match status.';
      const d=draw(1,7);
      if(!Number.isInteger(d)||d<1||d>6)throw Error('Invalid RNG result');
      const from=state.positions[me];let next=from+d;
      if(next>100)next=from;
      const landed=next;
      if(SNAKES[next])next=SNAKES[next]; else if(LADDERS[next])next=LADDERS[next];
      state.positions[me]=next;state.turnNo++;state.lastRoll={player:me+1,dice:d,from,landed,to:next};
      let earned=0;
      if(next===100){state.winner=me+1;m.status='DONE';m.completed_at=now;
        earned=pvp?.settle({game:'snakes',id:m.id,players:[m.player_a,m.player_b],winner:user,completed:true,eligible:true,now})?.[user]??0;}
      else {state.turn=1-me;m.expires_at=now+TURN_TTL;}
      m.state=JSON.stringify(state);save(m);
      db.prepare('INSERT INTO world_match_events(match_id,turn_no,actor,action,detail,created_at) VALUES(?,?,?,?,?,?)')
        .run(m.id,state.turnNo,user,'ROLL',JSON.stringify(state.lastRoll),now);
      const shift=landed!==next?(next>landed?'🪜 Naik tangga':'🐍 Turun kena ular'):'';
      return `🎲 P${me+1} melempar ${d}: ${from} → ${next} ${shift}\n${m.status==='DONE'?'🏆 PEMENANG P'+(me+1)+(earned?` 🎁 +${earned} V`: ''):'Giliran P'+(state.turn+1)}\nPapan: .match board ${m.id}`;
    }
    if(sub==='resign') {
      if(!['PENDING','ACTIVE'].includes(m.status))return `Status match: ${m.status}`;
      m.status='CANCELLED';m.completed_at=now;save(m);
      pvp?.settle({game:'snakes',id:m.id,players:[m.player_a,m.player_b],winner:null,completed:false,eligible:false,now});
      return `🏳️ Kamu keluar dari match ${m.id}. Tidak ada biaya atau taruhan.`;
    }
    return 'Gunakan .match current | accept | roll | board | status | resign [ID]';
  }
  function getBoard(user,id,now=Date.now()){
    const m=resolveMatch(user,id?String(id).toUpperCase():null);
    if(!m)return null;
    const state=JSON.parse(m.state);
    return {png:renderSnakeBoard({state,snakes:SNAKES,ladders:LADDERS}),filename:`wa-world-match-${m.id}.png`,caption:`🎲 Ular Tangga • ${m.id}\nP1 kotak ${state.positions[0]} • P2 kotak ${state.positions[1]}\n${m.status} · .match current`};
  }
  function stats(){
    return {waiting:db.prepare('SELECT COUNT(*) AS n FROM match_queue').get().n,
      pending:db.prepare("SELECT COUNT(*) AS n FROM world_matches WHERE status='PENDING'").get().n,
      active:db.prepare("SELECT COUNT(*) AS n FROM world_matches WHERE status='ACTIVE'").get().n,
      completed:db.prepare("SELECT COUNT(*) AS n FROM world_matches WHERE status='DONE'").get().n};
  }
  return {perform,getBoard,stats};
}
