import { EXTRA_GAMES,makeExtraGameDispatcher } from './games/expansion.js';
import { inTransaction } from './db.js';
import { randomInt, createHash } from 'node:crypto';

export const GAMES = [
  { id:'coin', name:'Lempar Koin', command:'.coin kepala', status:'playable' },
  { id:'rps', name:'Batu Gunting Kertas', command:'.rps batu', status:'playable' },
  { id:'guess', name:'Tebak Angka 1–10', command:'.guess start', status:'playable' },
  ...EXTRA_GAMES
];
const GAME_DAILY_CAP=100;
const jakartaDay = now => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const pseudonym = id => 'Player-'+createHash('sha256').update(id).digest('hex').slice(0,6).toUpperCase();
const level = xp => 1+Math.floor(Math.sqrt(xp/25));
export function createCore(db, options={}) {
  const draw=options.randomInt ?? randomInt;
  function ensureUser(id) {
    db.prepare('INSERT OR IGNORE INTO users(id) VALUES(?)').run(id);
    db.prepare('INSERT OR IGNORE INTO wallets(user_id) VALUES(?)').run(id);
    db.prepare('INSERT OR IGNORE INTO player_stats(user_id) VALUES(?)').run(id);
  }
  function profile(id) {
    return db.prepare(`SELECT u.id, u.tier, w.balance, u.created_at, p.xp, p.plays, p.wins, p.nickname, p.ranked
      FROM users u JOIN wallets w ON w.user_id=u.id JOIN player_stats p ON p.user_id=u.id WHERE u.id=?`).get(id);
  }
  function addXP(id,amount) {db.prepare('UPDATE player_stats SET xp=xp+? WHERE user_id=?').run(amount,id);}
  function missionProgress(id,now,field) {
    const day=jakartaDay(now);
    db.prepare('INSERT OR IGNORE INTO daily_mission_progress(user_id,day) VALUES(?,?)').run(id,day);
    if(!['plays','wins'].includes(field))throw Error('Invalid mission counter');
    db.prepare(`UPDATE daily_mission_progress SET ${field}=${field}+1 WHERE user_id=? AND day=?`).run(id,day);
  }
  function play(id,now) {
    db.prepare('UPDATE player_stats SET plays=plays+1 WHERE user_id=?').run(id);
    missionProgress(id,now,'plays');
  }
  function reward(id,credits,reason,eventKey,now,{dailyGame=false}={}) {
    if(!Number.isInteger(credits)||credits<=0||credits>100)throw Error('Invalid reward');
    const day=jakartaDay(now);
    let issued=credits;
    if(dailyGame) {
      const earned=db.prepare('SELECT earned FROM daily_game_earnings WHERE user_id=? AND day=?').get(id,day)?.earned ?? 0;
      issued=Math.max(0,Math.min(credits,GAME_DAILY_CAP-earned));
    }
    if(issued===0)return 0;
    const result=db.prepare('INSERT OR IGNORE INTO ledger(user_id,delta,reason,event_key) VALUES(?,?,?,?)')
      .run(id,issued,reason,`reward:${eventKey}`);
    if(result.changes===0)return 0;
    db.prepare('UPDATE wallets SET balance=balance+? WHERE user_id=?').run(issued,id);
    if(dailyGame) {
      db.prepare('INSERT INTO daily_game_earnings(user_id,day,earned) VALUES(?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET earned=earned+excluded.earned').run(id,day,issued);
      db.prepare('UPDATE player_stats SET wins=wins+1 WHERE user_id=?').run(id);
      missionProgress(id,now,'wins');
      addXP(id,issued*2);
    }
    return issued;
  }
  const extraGame=makeExtraGameDispatcher({db,draw,play,reward});
  function dispatch(senderId,eventKey,text,now) {
    const parts=text.trim().toLowerCase().split(/\s+/);
    const cmd=parts[0],args=parts.slice(1);
    if(cmd==='.ping')return 'PONG · WA-WORLD online.';
    if(['.menu','.help','.start'].includes(cmd))return `🌍 WA-WORLD v0.5.0\n.menu — beranda interaktif\n.games — daftar game utama\n.packs — tombol game tambahan\n.missions — misi harian\n.daily — hadiah harian (WIB)\n.profile — XP, level & statistik\n.rank — leaderboard opt-in\n.nick NAMA — atur nickname\n.wallet — saldo V-Currency\n.missions — misi harian\n.badges — pencapaian\n.coin kepala|ekor — lempar koin\n.rps batu|gunting|kertas — suit\n.guess start / .guess ANGKA — tebak angka\n.buttons native — uji tombol\n.games — semua ${GAMES.length} game\n.ai — AI (belum aktif)`;
    if(cmd==='.games'||cmd==='.play')return `🎮 ${GAMES.length}/100 game playable:\n${GAMES.map(g=>`${g.name}: ${g.command}`).join('\n')}\n\nMain gratis; hadiah game maksimal ${GAME_DAILY_CAP} V/hari (WIB).`;
    if(cmd==='.packs')return '🧩 Game packs: .pack lucky | .pack brain | .pack word. Game lainnya lihat .games.';
    if(cmd==='.pack') {
      if(args[0]==='lucky')return '🎲 Lucky Pack: .dice 4 / .parity genap / .highlow naik';
      if(args[0]==='brain')return '🧠 Brain Pack: .math start / .trivia start / .pattern start';
      if(args[0]==='word')return '🔤 Word Pack: .scramble start / .hangman start / .chain start';
      return 'Pilih .pack lucky | brain | word';
    }
    if(cmd==='.wallet')return `💰 Saldo: ${profile(senderId).balance} V-Currency\nTidak ada top-up, cash-out, atau tukar uang nyata.`;
    if(cmd==='.profile'){
      const p=profile(senderId);
      return `👤 ${p.nickname||pseudonym(senderId)}\nTier: ${p.tier}\nLevel: ${level(p.xp)} · XP: ${p.xp}\nDimainkan: ${p.plays} · Menang berhadiah: ${p.wins}\nSaldo: ${p.balance} V-Currency\nLeaderboard: ${p.ranked?'IKUT':'PRIVAT'}\nBergabung: ${p.created_at}`;
    }
    if(cmd==='.nick'){
      const name=text.trim().split(/\s+/).slice(1).join(' ');
      if(!/^[A-Za-z0-9_-]{3,18}$/.test(name))return 'Nickname 3–18 karakter: huruf, angka, _ atau -. Contoh: .nick Pahlawan77';
      const taken=db.prepare('SELECT 1 AS yes FROM player_stats WHERE lower(nickname)=lower(?) AND user_id<>?').get(name,senderId);
      if(taken)return 'Nickname sudah digunakan. Pilih nama lain.';
      db.prepare('UPDATE player_stats SET nickname=? WHERE user_id=?').run(name,senderId);
      return `✅ Nickname: ${name}. Gunakan .rank join untuk ikut leaderboard.`;
    }
    if(cmd==='.rank'){
      if(args[0]==='join'){
        if(!profile(senderId).nickname)return 'Atur nickname dahulu: .nick NamaAnda';
        db.prepare('UPDATE player_stats SET ranked=1 WHERE user_id=?').run(senderId);
        return '🏆 Kamu ikut leaderboard publik dengan nickname. Ketik .rank leave untuk keluar.';
      }
      if(args[0]==='leave'){
        db.prepare('UPDATE player_stats SET ranked=0 WHERE user_id=?').run(senderId);
        return '🔒 Kamu tidak lagi ditampilkan di leaderboard.';
      }
      const rows=db.prepare('SELECT nickname,xp,wins FROM player_stats WHERE ranked=1 AND nickname IS NOT NULL ORDER BY xp DESC,wins DESC,nickname ASC LIMIT 10').all();
      return rows.length ? `🏆 Leaderboard XP (opt-in)\n${rows.map((p,i)=>`${i+1}. ${p.nickname} · ${p.xp} XP · ${p.wins} menang`).join('\n')}\nIkut: .nick NAMA lalu .rank join` : '🏆 Belum ada pemain opt-in. Gunakan .nick NAMA lalu .rank join.';
    }
    if(cmd==='.daily') {
      const day=jakartaDay(now);
      const yesterday=jakartaDay(now-86_400_000);
      const last=db.prepare('SELECT claim_day,streak FROM daily_claims WHERE user_id=? ORDER BY claim_day DESC LIMIT 1').get(senderId);
      if(last?.claim_day===day)return `📅 Hadiah hari ini sudah diklaim! Streak: ${last.streak} hari. Reset 00:00 WIB.`;
      const streak=last?.claim_day===yesterday?last.streak+1:1;
      db.prepare('INSERT INTO daily_claims(user_id,claim_day,streak) VALUES(?,?,?)').run(senderId,day,streak);
      const amount=10;
      reward(senderId,amount,'daily-claim',`daily:${senderId}:${day}`,now);
      addXP(senderId,5);
      return `🎁 Daily berhasil! +${amount} V-Currency dan +5 XP. Streak ${streak} hari. Reset 00:00 WIB.`;
    }
    if(cmd==='.status')return 'WA-WORLD v0.5.0 · 16 game playable; QA offline + live flags · AI LLM belum aktif.';
    if(cmd==='.badges'){
      const p=profile(senderId);
      const days=db.prepare('SELECT count(*) AS n FROM daily_claims WHERE user_id=?').get(senderId).n;
      const unlocked=[p.plays>=1&&'🎮 Pemain Pertama',p.plays>=10&&'⚔️ Petualang 10 Game',p.wins>=5&&'🏆 Lima Kemenangan',p.xp>=100&&'⭐ 100 XP',p.balance>=50&&'💰 50 V',days>=3&&'📅 3 Daily Claims'].filter(Boolean);
      return unlocked.length?`🏅 Pencapaian (${unlocked.length}/6)\n${unlocked.join('\n')}`:'🏅 Belum ada badge. Mainkan game, klaim daily, dan kumpulkan XP!';
    }
    if(cmd==='.missions'||cmd==='.mission'){
      const day=jakartaDay(now);
      const progress=db.prepare('SELECT plays,wins FROM daily_mission_progress WHERE user_id=? AND day=?').get(senderId,day)??{plays:0,wins:0};
      const daily=!!db.prepare('SELECT 1 AS yes FROM daily_claims WHERE user_id=? AND claim_day=?').get(senderId,day);
      const entries=[['play3','Mainkan 3 ronde',progress.plays,3,8],['win2','Menang 2 kali',progress.wins,2,12],['daily','Klaim .daily',daily?1:0,1,5]];
      if(cmd==='.mission' && args[0]==='claim'){
        const mission=args[1];const entry=entries.find(m=>m[0]===mission);
        if(!entry)return 'Pilih .mission claim play3 | win2 | daily';
        if(entry[2]<entry[3])return `Misi ${mission} belum selesai (${entry[2]}/${entry[3]}).`;
        const found=db.prepare('SELECT 1 AS yes FROM daily_mission_claims WHERE user_id=? AND day=? AND mission=?').get(senderId,day,mission);
        if(found)return 'Hadiah misi ini sudah diklaim hari ini.';
        db.prepare('INSERT INTO daily_mission_claims(user_id,day,mission) VALUES(?,?,?)').run(senderId,day,mission);
        const issued=reward(senderId,entry[4],'mission-reward',`mission:${senderId}:${day}:${mission}`,now);
        return `✅ Misi ${mission} diklaim: +${issued} V-Currency.`;
      }
      return `📜 Misi harian (WIB)\n${entries.map(m=>`${m[1]} (${m[2]}/${m[3]}) · ${m[4]} V · .mission claim ${m[0]}`).join('\n')}\nHadiah misi di luar cap game.`;
    }
    if(cmd==='.ai')return 'AI LLM/ML self-hosted masih dalam backlog, belum aktif.';
    if(cmd==='.coin'){
      if(!['kepala','ekor'].includes(args[0]))return 'Gunakan .coin kepala atau .coin ekor';
      const actual=draw(0,2)===0?'kepala':'ekor',win=args[0]===actual;
      play(senderId,now);
      const credited=win?reward(senderId,3,'coin-win',eventKey,now,{dailyGame:true}):0;
      return `🪙 Koin: ${actual}. ${win?(credited?`Menang! +${credited} V-Currency (+${credited*2} XP)`:'Menang! Batas hadiah game hari ini tercapai.'):'Belum menang.'}`;
    }
    if(cmd==='.rps'){
      const choices=['batu','gunting','kertas'];
      if(!choices.includes(args[0]))return 'Gunakan .rps batu|gunting|kertas';
      const bot=choices[draw(0,3)],me=args[0];
      const win=(me==='batu'&&bot==='gunting')||(me==='gunting'&&bot==='kertas')||(me==='kertas'&&bot==='batu');
      play(senderId,now);
      const credited=win?reward(senderId,4,'rps-win',eventKey,now,{dailyGame:true}):0;
      return `✊ Kamu: ${me}. Bot: ${bot}. ${me===bot?'Seri.':win?(credited?`Menang! +${credited} V-Currency (+${credited*2} XP)`:'Menang! Batas hadiah game hari ini tercapai.'):'Kalah.'}`;
    }
    if(cmd==='.guess'){
      if(args[0]==='start'){
        const secret=draw(1,11);
        db.prepare(`INSERT INTO game_sessions(user_id,name,secret,attempts_left,updated_at) VALUES(?,'guess',?,3,?)
          ON CONFLICT(user_id) DO UPDATE SET name='guess',secret=excluded.secret,attempts_left=3,updated_at=excluded.updated_at`).run(senderId,secret,now);
        return '🔢 Tebak angka 1–10 dalam 3 percobaan. Ketik .guess ANGKA';
      }
      if(!/^([1-9]|10)$/.test(args[0]??''))return 'Gunakan .guess start atau .guess ANGKA (1–10)';
      const session=db.prepare('SELECT secret,attempts_left,updated_at FROM game_sessions WHERE user_id=?').get(senderId);
      if(!session||now-session.updated_at>15*60*1000){db.prepare('DELETE FROM game_sessions WHERE user_id=?').run(senderId);return 'Tidak ada sesi tebak angka aktif. Gunakan .guess start';}
      const guess=Number(args[0]);
      if(guess===session.secret){
        db.prepare('DELETE FROM game_sessions WHERE user_id=?').run(senderId);
        play(senderId,now);
        const credited=reward(senderId,session.attempts_left*5,'guess-win',eventKey,now,{dailyGame:true});
        return `🎉 Benar! Angkanya ${guess}. ${credited?`+${credited} V-Currency (+${credited*2} XP)`:'Batas hadiah game hari ini tercapai.'}`;
      }
      const attempts=session.attempts_left-1;
      if(attempts<=0){db.prepare('DELETE FROM game_sessions WHERE user_id=?').run(senderId);play(senderId,now);return `❌ Kesempatan habis. Jawabannya ${session.secret}. Mulai lagi: .guess start`;}
      db.prepare('UPDATE game_sessions SET attempts_left=?,updated_at=? WHERE user_id=?').run(attempts,now,senderId);
      return `${guess<session.secret?'⬆️ Terlalu kecil':'⬇️ Terlalu besar'}. Tersisa ${attempts} percobaan.`;
    }
    const expanded=extraGame(senderId,eventKey,text,now);
    if(expanded!==null)return expanded;
    return 'Perintah tidak dikenal. Ketik .menu';
  }
  return {profile,process({senderId,eventKey,text,now=Date.now()}){
    if(typeof senderId!=='string'||senderId.length>180||senderId.length<1)throw Error('Invalid sender');
    if(typeof eventKey!=='string'||eventKey.length>350||eventKey.length<1)throw Error('Invalid event key');
    if(typeof text!=='string'||text.length>300)return 'Pesan terlalu panjang atau tidak valid.';
    return inTransaction(db,()=>{
      const previous=db.prepare('SELECT response FROM processed_messages WHERE event_key=?').get(eventKey);
      if(previous)return previous.response;
      ensureUser(senderId);
      const response=dispatch(senderId,eventKey,text,now);
      db.prepare('INSERT INTO processed_messages(event_key,sender_id,response) VALUES(?,?,?)').run(eventKey,senderId,response);
      return response;
    });
  }};
}
