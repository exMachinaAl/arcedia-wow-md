/** WA-WORLD v1.6 — free, non-wagered arcade. No buy-ins, cash-out, trades or transferable economic prizes.
 * All probability is fixed and public; ML must never alter odds or RNG outcomes.
 * Arcade rewards may add non-transferable BOUND V for fixed-price cosmetics only.
 */
import { randomInt as secureInt, randomBytes, createHash } from 'node:crypto';

const DAY = now => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const SYMBOLS=['🍒','⭐','💎'];
const CAPSULES=Object.freeze([
  {id:'bronze-star',name:'Bronze Star',rarity:'COMMON',weight:7000},
  {id:'moon-pin',name:'Moon Pin',rarity:'UNCOMMON',weight:2400},
  {id:'aurora-emblem',name:'Aurora Emblem',rarity:'RARE',weight:500},
  {id:'celestial-crown',name:'Celestial Crown',rarity:'LEGENDARY',weight:100}
]);
const LANES=Object.freeze({safe:{chance:7000,score:10},balanced:{chance:3500,score:25},legend:{chance:1000,score:80}});
const MAX_SPINS=3;
const MAX_ROOMS_DAILY=3;
const ROOM_TTL=30*60*1000;

export function longestRun(symbols){
  if(!Array.isArray(symbols)||symbols.length!==10||symbols.some(s=>!SYMBOLS.includes(s)))throw Error('Invalid 10-symbol reel');
  let best=1,run=1;
  for(let i=1;i<symbols.length;i++){run=symbols[i]===symbols[i-1]?run+1:1;best=Math.max(best,run);}
  return best;
}
export function initArcade(db){
 db.exec(`
 CREATE TABLE IF NOT EXISTS arcade_capsules(
   user_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL,item_id TEXT NOT NULL,
   draw_value INTEGER NOT NULL CHECK(draw_value BETWEEN 0 AND 9999),event_key TEXT NOT NULL UNIQUE,
   PRIMARY KEY(user_id,day));
 CREATE TABLE IF NOT EXISTS arcade_cosmetics(
   user_id TEXT NOT NULL REFERENCES users(id),item_id TEXT NOT NULL,
   first_claimed_ms INTEGER NOT NULL,PRIMARY KEY(user_id,item_id));
 CREATE TABLE IF NOT EXISTS arcade_spins(
   id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL,
   slot_index INTEGER NOT NULL CHECK(slot_index BETWEEN 1 AND 3),symbols_json TEXT NOT NULL,
   longest_run INTEGER NOT NULL CHECK(longest_run BETWEEN 1 AND 10),score INTEGER NOT NULL CHECK(score>=0),
   created_ms INTEGER NOT NULL,UNIQUE(user_id,day,slot_index));
 CREATE TABLE IF NOT EXISTS risk_rooms(
   code TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL CHECK(status IN('OPEN','DONE')),
   created_ms INTEGER NOT NULL,expires_ms INTEGER NOT NULL,draw_value INTEGER CHECK(draw_value BETWEEN 0 AND 9999),
   completed_ms INTEGER);
 CREATE TABLE IF NOT EXISTS risk_entries(
   room_code TEXT NOT NULL REFERENCES risk_rooms(code),user_id TEXT NOT NULL REFERENCES users(id),
   lane TEXT CHECK(lane IN('safe','balanced','legend')),score INTEGER NOT NULL DEFAULT 0,
   joined_ms INTEGER NOT NULL,PRIMARY KEY(room_code,user_id));
 CREATE INDEX IF NOT EXISTS idx_risk_user ON risk_entries(user_id,room_code);
 `);
}
export function createArcade({db,randomInt=secureInt,grantBound=()=>0,codeGenerator=()=>randomBytes(4).toString('hex').toUpperCase()}) {
  const draw=(min,max)=>{
    const n=randomInt(min,max);
    if(!Number.isSafeInteger(n)||n<min||n>=max)throw Error('RNG returned out of bounds');
    return n;
  };
  const pseudonym=id=>'P-'+createHash('sha256').update(id).digest('hex').slice(0,6).toUpperCase();
  const scoreOf=user=>{
    const slot=db.prepare('SELECT COALESCE(SUM(score),0) AS n FROM arcade_spins WHERE user_id=?').get(user).n;
    const risk=db.prepare('SELECT COALESCE(SUM(score),0) AS n FROM risk_entries WHERE user_id=?').get(user).n;
    return Number(slot)+Number(risk);
  };
  function status(userId,now){
    const day=DAY(now),spins=db.prepare('SELECT COUNT(*) AS n FROM arcade_spins WHERE user_id=? AND day=?').get(userId,day).n;
    const got=db.prepare('SELECT COUNT(*) AS n FROM arcade_cosmetics WHERE user_id=?').get(userId).n;
    return `🎡 FREE ARCADE · Tanpa taruhan/top-up/cash-out\n🎁 .gacha claim — 1 gratis/hari WIB (${db.prepare('SELECT 1 FROM arcade_capsules WHERE user_id=? AND day=?').get(userId,day)?'SUDAH':'TERSEDIA'})\n🎰 .slot spin — ${MAX_SPINS-spins}/${MAX_SPINS} spin gratis hari ini\n🤝 .risk — multiplayer pilih tantangan\n🌟 Skor hiburan: ${scoreOf(userId)} (tidak dapat ditukar/ditransfer)\n💠 Arcade V terikat: .wow wallet — reward terbatas untuk kosmetik\n🏛️ Koleksi arcade: ${got}/${CAPSULES.length}\nKetik .arcade | .gacha odds | .slot odds`;
  }
  function capsule(userId,eventKey,now){
    const day=DAY(now);
    const old=db.prepare('SELECT item_id FROM arcade_capsules WHERE user_id=? AND day=?').get(userId,day);
    if(old)return `🎁 Kapsul hari ini sudah dibuka: ${CAPSULES.find(x=>x.id===old.item_id)?.name}. Reset 00.00 WIB.`;
    const value=draw(0,10000);let running=0;
    const item=CAPSULES.find(x=>(running+=x.weight)>value);
    if(!item)throw Error('Capsule odds do not sum to 10000');
    db.prepare('INSERT INTO arcade_capsules(user_id,day,item_id,draw_value,event_key) VALUES(?,?,?,?,?)').run(userId,day,item.id,value,eventKey);
    const saved=db.prepare('INSERT OR IGNORE INTO arcade_cosmetics(user_id,item_id,first_claimed_ms) VALUES(?,?,?)').run(userId,item.id,now);
    const bound=grantBound(userId,`bound:gacha:${userId}:${day}`,now,2,'free-gacha');
    return `🎁 KAPSUL GRATIS: ${item.name} [${item.rarity}]${saved.changes?' 🎉 Baru!':' (duplikat koleksi)'}\n+${bound} Arcade V TERIKAT (untuk kosmetik, bukan taruhan). .wow wallet\nTanpa biaya/penjualan/perdagangan. Lihat .gacha collection`;
  }
  function spin(userId,eventKey,now){
    const day=DAY(now),used=Number(db.prepare('SELECT COUNT(*) AS n FROM arcade_spins WHERE user_id=? AND day=?').get(userId,day).n);
    if(used>=MAX_SPINS)return `🎰 Batas ${MAX_SPINS} spin gratis/hari tercapai. Tidak ada pembelian spin.`;
    const symbols=Array.from({length:10},()=>SYMBOLS[draw(0,SYMBOLS.length)]);
    const run=longestRun(symbols),score=run<3?0:5*2**(run-3);
    db.prepare('INSERT INTO arcade_spins(id,user_id,day,slot_index,symbols_json,longest_run,score,created_ms) VALUES(?,?,?,?,?,?,?,?)')
      .run(eventKey,userId,day,used+1,JSON.stringify(symbols),run,score,now);
    const bound=grantBound(userId,`bound:slot:${eventKey}`,now,Math.min(score,20),'free-slot-match');
    return `🎰 SYMBOL MATCH (${used+1}/${MAX_SPINS} gratis hari ini)\n${symbols.join(' | ')}\n${run>=3?`✅ ${run} simbol identik beruntun!`:'Belum ada 3 simbol beruntun.'}\n+${score} Arcade Score • +${bound} Arcade V TERIKAT (kosmetik, bukan uang / transferable V)\n.spin lagi: .slot spin`;
  }
  function room(userId,code,now){
    const r=db.prepare('SELECT * FROM risk_rooms WHERE code=?').get(code);
    if(!r)return 'Room tidak ditemukan. Cek kodenya.';
    const members=db.prepare('SELECT user_id,lane,score FROM risk_entries WHERE room_code=? ORDER BY joined_ms,user_id').all(code);
    const done=r.status==='DONE',expired=!done&&r.expires_ms<=now;
    return `🤝 ROOM ${r.code} — ${done?'SELESAI':expired?'KEDALUWARSA':'OPEN'}\nPemain ${members.length}/8 · Siap ${members.filter(m=>m.lane).length}/${members.length}\n${members.map(m=>`${pseudonym(m.user_id)}: ${m.lane??'belum memilih'}${done?` · ${m.score} poin`:''}`).join('\n')}\n${done?`Angka undian bersama: ${r.draw_value}/9999`:''}\nPilihan: .risk choose ${code} safe|balanced|legend\nBergabung: .risk join ${code}\nPemilik room: .risk resolve ${code}\nKeluar sebelum resolve: .risk leave ${code}`;
  }
  function createRoom(userId,now){
    const day=DAY(now);
    const created=db.prepare('SELECT COUNT(*) AS n FROM risk_rooms WHERE owner_id=? AND created_ms>=?').get(userId,Date.parse(day+'T00:00:00+07:00')).n;
    if(created>=MAX_ROOMS_DAILY)return 'Batas 3 room baru/hari WIB tercapai.';
    const active=db.prepare("SELECT COUNT(*) AS n FROM risk_rooms WHERE owner_id=? AND status='OPEN' AND expires_ms>?").get(userId,now).n;
    if(active>=2)return 'Selesaikan room terbuka terlebih dahulu (maks. 2).';
    let code;
    for(let i=0;i<5;i++){
      const candidate=codeGenerator();
      if(/^[A-F0-9]{8}$/.test(candidate)&&!db.prepare('SELECT 1 FROM risk_rooms WHERE code=?').get(candidate)){code=candidate;break;}
    }
    if(!code)throw Error('Could not allocate unique room code');
    db.prepare("INSERT INTO risk_rooms(code,owner_id,status,created_ms,expires_ms) VALUES(?,?,'OPEN',?,?)").run(code,userId,now,now+ROOM_TTL);
    db.prepare('INSERT INTO risk_entries(room_code,user_id,joined_ms) VALUES(?,?,?)').run(code,userId,now);
    return `🤝 ROOM ${code} dibuat! Kirim kode ke teman secara sukarela.\n.risk join ${code} (2–8 pemain)\n.risk choose ${code} safe|balanced|legend\n.risk resolve ${code} setelah semua memilih. Tidak ada taruhan.`;
  }
  function requireOpen(code,now){
    const r=db.prepare('SELECT * FROM risk_rooms WHERE code=?').get(code);
    if(!r||r.status!=='OPEN')return {error:'Room tidak ada atau sudah selesai.'};
    if(r.expires_ms<=now)return {error:'Room sudah kedaluwarsa (30 menit).'};
    return {room:r};
  }
  function risk(userId,args,now){
    const op=args[0];const code=(args[1]??'').toUpperCase();
    if(!op || op==='help' || op==='odds')return '🤝 RISK ROOMS (NO WAGER)\nSemua pemain memilih jalur, SATU angka acak untuk satu room:\nsafe 70% → 10 skor; balanced 35% → 25 skor; legend 10% → 80 skor.\nGagal = 0 skor, tidak kehilangan apa pun. Skor nontransferable.\n.risk create | join KODE | choose KODE safe|balanced|legend | status KODE | leave KODE | resolve KODE';
    if(op==='create')return createRoom(userId,now);
    if(!/^[A-F0-9]{8}$/.test(code))return 'Kode room harus 8 karakter heksadesimal.';
    if(op==='status'){
      const m=db.prepare('SELECT 1 FROM risk_entries WHERE room_code=? AND user_id=?').get(code,userId);
      return m?room(userId,code,now):'Hanya peserta yang bisa melihat room.';
    }
    if(op==='join'){
      const res=requireOpen(code,now);if(res.error)return res.error;
      if(db.prepare('SELECT 1 FROM risk_entries WHERE room_code=? AND user_id=?').get(code,userId))return 'Anda sudah ada dalam room.';
      const dayStart=Date.parse(DAY(now)+'T00:00:00+07:00');
      const joinedToday=db.prepare('SELECT COUNT(*) AS n FROM risk_entries WHERE user_id=? AND joined_ms>=?').get(userId,dayStart).n;
      if(joinedToday>=6)return 'Batas 6 room diikuti per hari WIB tercapai (anti-farming).';
      const count=db.prepare('SELECT COUNT(*) AS n FROM risk_entries WHERE room_code=?').get(code).n;
      if(count>=8)return 'Room sudah penuh (8 pemain).';
      db.prepare('INSERT INTO risk_entries(room_code,user_id,joined_ms) VALUES(?,?,?)').run(code,userId,now);
      return `✅ Bergabung ke ${code}. Pilih jalur: .risk choose ${code} safe|balanced|legend`;
    }
    if(op==='choose'){
      const res=requireOpen(code,now);if(res.error)return res.error;
      const lane=(args[2]??'').toLowerCase();if(!LANES[lane])return 'Pilihan: safe | balanced | legend';
      const updated=db.prepare('UPDATE risk_entries SET lane=? WHERE room_code=? AND user_id=?').run(lane,code,userId);
      return updated.changes?`✅ Pilihan ${lane.toUpperCase()} tersimpan untuk room ${code}. Peluang ${LANES[lane].chance/100}% (tanpa taruhan).`:'Bergabung melalui .risk join KODE dahulu.';
    }
    if(op==='leave'){
      const res=requireOpen(code,now);if(res.error)return res.error;
      if(res.room.owner_id===userId)return 'Pemilik tidak dapat keluar. Room akan berakhir setelah 30 menit jika tidak digunakan.';
      const deleted=db.prepare('DELETE FROM risk_entries WHERE room_code=? AND user_id=?').run(code,userId);
      return deleted.changes?'✅ Anda keluar tanpa kehilangan apa pun.':'Anda bukan peserta room.';
    }
    if(op==='resolve'){
      const res=requireOpen(code,now);if(res.error)return res.error;
      if(res.room.owner_id!==userId)return 'Hanya pembuat room boleh menyelesaikan tantangan.';
      const members=db.prepare('SELECT user_id,lane FROM risk_entries WHERE room_code=?').all(code);
      if(members.length<2)return 'Butuh setidaknya 2 peserta.';
      if(members.some(m=>!m.lane))return `Masih ada ${members.filter(m=>!m.lane).length} peserta yang belum memilih.`;
      const value=draw(0,10000);
      db.prepare("UPDATE risk_rooms SET status='DONE',draw_value=?,completed_ms=? WHERE code=? AND status='OPEN'").run(value,now,code);
      for(const member of members){
        const points=value<LANES[member.lane].chance?LANES[member.lane].score:0;
        db.prepare('UPDATE risk_entries SET score=? WHERE room_code=? AND user_id=?').run(points,code,member.user_id);
        if(points>0)grantBound(member.user_id,`bound:risk:${code}:${member.user_id}`,now,Math.min(points,20),'free-risk-room');
      }
      return `🎯 Ronde selesai! Angka bersama: ${value}/9999\n${room(userId,code,now)}\nPemain sukses memperoleh Arcade V terikat, dibatasi 40 V/hari; tidak bisa ditransfer. Tidak ada pemain kehilangan saldo/item.`;
    }
    return 'Gunakan .risk help';
  }
  function dispatch(userId,eventKey,text,now){
    const p=text.trim().toLowerCase().split(/\s+/);const cmd=p[0],args=p.slice(1);
    if(!['.arcade','.gacha','.slot','.risk'].includes(cmd))return null;
    if(cmd==='.arcade')return status(userId,now);
    if(cmd==='.gacha'){
      if(args[0]==='odds')return '🎁 PELUANG KAPSUL GRATIS: COMMON 70%, UNCOMMON 24%, RARE 5%, LEGENDARY 1%. Tetap setiap hari; tidak diubah ML. Tidak dapat dibeli/diperdagangkan.';
      if(args[0]==='collection'){
        const ids=new Set(db.prepare('SELECT item_id FROM arcade_cosmetics WHERE user_id=?').all(userId).map(x=>x.item_id));
        return `🎁 KOLEKSI GACHA ${ids.size}/4\n${CAPSULES.map(c=>`${ids.has(c.id)?'✅':'⬜'} ${c.name} (${c.rarity})`).join('\n')}\nBukan aset ekonomi.`;
      }
      return args[0]==='claim'?capsule(userId,eventKey,now):'Gunakan .gacha claim | odds | collection (sekali gratis/hari)';
    }
    if(cmd==='.slot'){
      if(args[0]==='odds')return '🎰 SYMBOL MATCH: 10 posisi, masing-masing 🍒 ⭐ 💎 sama peluang (1/3), diambil independen. Skor dari rentetan simbol sama terpanjang (3–10). Tidak ada taruhan/biaya/pembelian putaran.';
      return args[0]==='spin'?spin(userId,eventKey,now):'Gunakan .slot spin | .slot odds (3 putaran gratis/hari)';
    }
    return risk(userId,args,now);
  }
  const stats=()=>({capsules:Number(db.prepare('SELECT COUNT(*) AS n FROM arcade_capsules').get().n),spins:Number(db.prepare('SELECT COUNT(*) AS n FROM arcade_spins').get().n),rooms:Number(db.prepare('SELECT COUNT(*) AS n FROM risk_rooms').get().n),finishedRooms:Number(db.prepare("SELECT COUNT(*) AS n FROM risk_rooms WHERE status='DONE'").get().n)});
  return {dispatch,status,stats,scoreOf};
}
