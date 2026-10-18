/** WOW v2.0 - persistent world events and privacy-preserving opt-in online recommender.
 * Not used for outcomes of any chance, ranked or paid-simulation games.
 */
import {randomBytes, createHmac, createHash} from 'node:crypto';
import {DAY} from './world-economy.js';

const ACTIVITIES=Object.freeze({mining:{command:'.mine',label:'Mining'},career:{command:'.career shift',label:'Profesi'},crafting:{command:'.craft',label:'Crafting'},market:{command:'.market',label:'Pasar Fiktif'},pvp:{command:'.pvp',label:'PvP'},arcade:{command:'.arcade',label:'Arcade'}});
const EVENTS=Object.freeze([
  {id:'COPPER_RUSH',title:'Copper Rush',mission:'mining',reward:8,flavor:'Tambang WOW sedang ramai; misi ekspedisi Mining terbuka.'},
  {id:'ARTISAN_FAIR',title:'Artisan Fair',mission:'crafting',reward:10,flavor:'Festival kerajinan virtual; ekspedisi Crafting terbuka.'},
  {id:'NOVA_EXPO',title:'Nova Expo',mission:'market',reward:6,flavor:'Pameran ekonomi fiktif; ekspedisi Market terbuka.'},
  {id:'CAREER_WEEK',title:'Career Week',mission:'career',reward:9,flavor:'Hari profesi dunia WOW; ekspedisi Career terbuka.'}
]);
const safeText=x=>String(x??'').replace(/[\r\n]/g,' ').slice(0,40);
const number=x=>Number(x??0);
export function initWorldIntelligence(db){
 db.exec(`
 CREATE TABLE IF NOT EXISTS wow_world_seed (slot INTEGER PRIMARY KEY CHECK(slot=1), secret TEXT NOT NULL, created_ms INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS wow_day_events(day TEXT PRIMARY KEY, event_id TEXT NOT NULL, roll INTEGER NOT NULL, commitment TEXT NOT NULL, created_ms INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS wow_world_quests(user_id TEXT NOT NULL REFERENCES users(id), day TEXT NOT NULL, event_id TEXT NOT NULL, event_key TEXT NOT NULL UNIQUE, reward INTEGER NOT NULL, claimed_ms INTEGER NOT NULL, PRIMARY KEY(user_id,day));
 CREATE TABLE IF NOT EXISTS wow_reco_preferences(user_id TEXT PRIMARY KEY REFERENCES users(id), enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)), created_ms INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS wow_reco_signals(user_id TEXT NOT NULL REFERENCES users(id), category TEXT NOT NULL, impressions INTEGER NOT NULL DEFAULT 0, positive INTEGER NOT NULL DEFAULT 0, negative INTEGER NOT NULL DEFAULT 0, uses INTEGER NOT NULL DEFAULT 0, updated_ms INTEGER NOT NULL, PRIMARY KEY(user_id,category), CHECK(impressions>=0 AND positive>=0 AND negative>=0 AND uses>=0));
 CREATE TABLE IF NOT EXISTS wow_reco_event_keys(event_key TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), category TEXT NOT NULL, created_ms INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS wow_reco_daily(user_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL, shown_category TEXT NOT NULL, PRIMARY KEY(user_id,day));
 `);
 // Seeding in the local SQLite database, never from public user input.
 if(!db.prepare('SELECT slot FROM wow_world_seed WHERE slot=1').get()){
  db.prepare('INSERT OR IGNORE INTO wow_world_seed(slot,secret,created_ms) VALUES(1,?,?)').run(randomBytes(32).toString('hex'),Date.now());
 }
}
export function createWorldIntelligence({db,credit=()=>0}){
 const selected=(id)=>db.prepare('SELECT enabled FROM wow_reco_preferences WHERE user_id=?').get(id)?.enabled===1;
 const seed=()=>db.prepare('SELECT secret FROM wow_world_seed WHERE slot=1').get()?.secret;
 function event(now=Date.now()){
  const day=DAY(now);
  const existing=db.prepare('SELECT * FROM wow_day_events WHERE day=?').get(day);
  if(existing)return {...EVENTS.find(x=>x.id===existing.event_id),day,roll:existing.roll,commitment:existing.commitment};
  const secret=seed();
  if(!secret)throw Error('World seed not initialized');
  const digest=createHmac('sha256',Buffer.from(secret,'hex')).update('WOW:WORLD-EVENT:'+day).digest();
  const roll=digest.readUInt32BE(0);
  const choice=EVENTS[roll%EVENTS.length];
  // Commitment to world seed can be verified by an administrator, without exposing it to players.
  const commitment=createHash('sha256').update(secret).digest('hex');
  db.prepare('INSERT OR IGNORE INTO wow_day_events(day,event_id,roll,commitment,created_ms) VALUES(?,?,?,?,?)').run(day,choice.id,roll,commitment,now);
  const saved=db.prepare('SELECT * FROM wow_day_events WHERE day=?').get(day);
  return {...EVENTS.find(x=>x.id===saved.event_id),day,roll:saved.roll,commitment:saved.commitment};
 }
 function quest(id,key,now){
  const e=event(now);
  const claimed=db.prepare('SELECT reward FROM wow_world_quests WHERE user_id=? AND day=?').get(id,e.day);
  if(claimed)return `✅ Ekspedisi ${e.day} sudah diklaim (+${claimed.reward} V). Besok ada event berbeda.`;
  const amount=e.reward;
  const unique=`world-quest:${id}:${e.day}`;
  db.prepare('INSERT INTO wow_world_quests(user_id,day,event_id,event_key,reward,claimed_ms) VALUES(?,?,?,?,?,?)').run(id,e.day,e.id,unique,amount,now);
  const issued=credit(id,amount,'world-event-quest',unique,now);
  return `🌍 ${e.title}: Ekspedisi selesai! +${issued} V dari dunia WOW. Misi tematik: ${e.mission}. Satu klaim/hari.`;
 }
 function playerStats(id){
  const p=db.prepare('SELECT u.created_at,p.nickname,p.xp,p.plays,p.wins,w.balance FROM users u JOIN player_stats p ON p.user_id=u.id JOIN wallets w ON w.user_id=u.id WHERE u.id=?').get(id);
  if(!p)return null;
  const mine=number(db.prepare('SELECT COUNT(*) AS n FROM world_mining WHERE user_id=?').get(id)?.n);
  const trades=number(db.prepare('SELECT COUNT(*) AS n FROM world_market_trades WHERE user_id=?').get(id)?.n);
  const owned=number(db.prepare('SELECT COUNT(*) AS n FROM wow_collection WHERE user_id=?').get(id)?.n);
  const quests=number(db.prepare('SELECT COUNT(*) AS n FROM wow_world_quests WHERE user_id=?').get(id)?.n);
  const crafted=number(db.prepare('SELECT COUNT(*) AS n FROM wow_collection WHERE user_id=?').get(id)?.n);
  const winRate=p.plays?((p.wins/p.plays)*100).toFixed(1):'0.0';
  const level=1+Math.floor(Math.sqrt(p.xp/25));
  return {nickname:p.nickname??'WOW Explorer',xp:p.xp,level,plays:p.plays,wins:p.wins,winRate,balance:p.balance,mine,trades,owned,quests,crafted};
 }
 function worldStats(){
  const q=sql=>number(db.prepare(sql).get()?.n);
  const users=q('SELECT COUNT(*) AS n FROM users');
  const supply=q('SELECT COALESCE(SUM(balance),0) AS n FROM wallets');
  const played=q('SELECT COALESCE(SUM(plays),0) AS n FROM player_stats');
  const completed=q('SELECT COUNT(*) AS n FROM wow_world_quests');
  const claimed=q('SELECT COUNT(*) AS n FROM daily_claims');
  const spent=q('SELECT COALESCE(SUM(-delta),0) AS n FROM wow_v_events WHERE delta<0');
  const issued=q('SELECT COALESCE(SUM(delta),0) AS n FROM wow_v_events WHERE delta>0');
  const mining=q('SELECT COUNT(*) AS n FROM world_mining');
  const activeRecommend=q('SELECT COUNT(*) AS n FROM wow_reco_preferences WHERE enabled=1');
  return {users,supply,played,completed,claimed,spent,issued,mining,activeRecommend};
 }
 function card(id){
  const p=playerStats(id);
  const bar=n=>'▰'.repeat(Math.min(10,Math.floor(n/10)))+'▱'.repeat(10-Math.min(10,Math.floor(n/10)));
  return `╭━━ 🌍 WOW PLAYER CARD ━━╮\n👤 ${safeText(p.nickname)}  · LV ${p.level}\n⭐ XP ${p.xp}  · 💰 ${p.balance} V\n🎮 ${p.plays} main · 🏆 ${p.wins} menang\n📈 Win rate ${p.winRate}%\n${bar(Number(p.winRate))}\n⛏️ Mining ${p.mine}  · 📊 Market ${p.trades}\n🎒 Koleksi ${p.owned}  · 🌐 Ekspedisi ${p.quests}\n╰━━ .stats world | .smart ━━╯`;
 }
 function recommend(id,now){
  if(!selected(id))return '🔒 Rekomendasi personal nonaktif. Aktifkan sukarela melalui .smart on (hanya statistik kategori, bukan isi chat).';
  const samples=db.prepare('SELECT category,impressions,positive,negative,uses FROM wow_reco_signals WHERE user_id=?').all(id);
  const stats=new Map(samples.map(x=>[x.category,x]));
  const actions=Object.keys(ACTIVITIES);
  // Online contextual preference estimator: posterior Beta mean plus confidence bonus for exploration.
  const total=samples.reduce((a,b)=>a+b.impressions,0);
  const scores=actions.map(category=>{
   const row=stats.get(category)??{impressions:0,positive:0,negative:0,uses:0};
   const signals=row.positive+row.negative;
   const preference=(row.positive+1)/(signals+2);
   const exploration=Math.sqrt(2*Math.log(total+2)/(row.impressions+1))*0.16;
   const usage=Math.min(0.15,row.uses*0.02);
   return {category,score:preference+exploration+usage,uses:row.uses,signals};
  }).sort((a,b)=>b.score-a.score||a.category.localeCompare(b.category));
  const top=scores[0];const day=DAY(now);
  db.prepare('INSERT INTO wow_reco_daily(user_id,day,shown_category) VALUES(?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET shown_category=excluded.shown_category').run(id,day,top.category);
  db.prepare('INSERT INTO wow_reco_signals(user_id,category,impressions,updated_ms) VALUES(?,?,1,?) ON CONFLICT(user_id,category) DO UPDATE SET impressions=impressions+1,updated_ms=excluded.updated_ms').run(id,top.category,now);
  return `🧠 WOW LEARNING RECOMMENDATION\nCoba ${ACTIVITIES[top.category].label}: ${ACTIVITIES[top.category].command}\nMode: online-learning preferensi (bukan ML hasil peluang). Data sinyal: ${top.signals}; penggunaan: ${top.uses}.\nBeri feedback: .smart like ${top.category} atau .smart skip ${top.category}.\nSemua rekomendasi hanya saran, tidak mengubah RNG/payout.`;
 }
 function track(id,key,text,now){
  if(!selected(id))return;
  const cmd=text.trim().toLowerCase().split(/\s+/)[0];
  const category=({'.mine':'mining','.career':'career','.craft':'crafting','.market':'market','.chess':'pvp','.pvp':'pvp','.queue':'pvp','.arcade':'arcade','.slot':'arcade','.risk':'arcade'})[cmd];
  if(!category)return;
  if(!db.prepare('INSERT OR IGNORE INTO wow_reco_event_keys(event_key,user_id,category,created_ms) VALUES(?,?,?,?)').run(key,id,category,now).changes)return;
  db.prepare('INSERT INTO wow_reco_signals(user_id,category,uses,updated_ms) VALUES(?,?,1,?) ON CONFLICT(user_id,category) DO UPDATE SET uses=uses+1,updated_ms=excluded.updated_ms').run(id,category,now);
 }
 function dispatch(id,key,text,now){
  const bits=text.trim().toLowerCase().split(/\s+/);const cmd=bits[0];
  if(cmd==='.stats'){
   if(bits[1]==='world'){
    const s=worldStats();return `🌐 WOW SERVER STATISTICS\n👥 Pemain ${s.users}  · 🎮 Total rounds ${s.played}\n💰 Total saldo ${s.supply} V\n📥 V terbit baru ${s.issued} · 📤 V keluar ${s.spent}\n⛏️ Mining ${s.mining} · 🎁 Daily ${s.claimed}\n🗺️ Ekspedisi selesai ${s.completed}\n🧠 Personal learning opt-in ${s.activeRecommend}\nHanya angka agregat, tanpa nomor WhatsApp.`;
   }
   return card(id);
  }
  if(cmd==='.world' && ['event','events','quest','audit'].includes(bits[1])){
   const e=event(now);
   if(bits[1]==='quest')return quest(id,key,now);
   if(bits[1]==='audit')return `🔍 WORLD AUDIT ${e.day}\nEvent ${e.id}\nRoll uint32: ${e.roll}\nCommitment seed: ${e.commitment}\nTerikat pada secret lokal + tanggal WIB; RNG permainan tidak dipengaruhi ML.`;
   return `🌦️ WORLD EVENT ${e.day}\n${e.title}\n${e.flavor}\nMisi hari ini: ${e.mission} · Reward ${e.reward} V\nKlaim satu ekspedisi gratis: .world quest\nAudit: .world audit`;
  }
  if(cmd==='.smart'){
   if(bits[1]==='on'){
    db.prepare('INSERT INTO wow_reco_preferences(user_id,enabled,created_ms) VALUES(?,1,?) ON CONFLICT(user_id) DO UPDATE SET enabled=1').run(id,now);
    return '✅ Pembelajaran preferensi aktif (sukarela). Hanya kategori aktivitas dan feedback, tidak menyimpan teks percakapan. .smart off untuk hapus semua data personalisasi.';
   }
   if(bits[1]==='off'){
    db.prepare('DELETE FROM wow_reco_event_keys WHERE user_id=?').run(id);
    db.prepare('DELETE FROM wow_reco_signals WHERE user_id=?').run(id);
    db.prepare('DELETE FROM wow_reco_daily WHERE user_id=?').run(id);
    db.prepare('DELETE FROM wow_reco_preferences WHERE user_id=?').run(id);
    return '🔒 Pembelajaran nonaktif; seluruh data preferensi Anda dihapus dari tabel rekomendasi.';
   }
   if(bits[1]==='status')return `🧠 Learning ${selected(id)?'ON':'OFF'} · Data personalisasi ${db.prepare('SELECT COALESCE(SUM(uses+positive+negative),0) AS n FROM wow_reco_signals WHERE user_id=?').get(id).n} sinyal. .smart on|off`;
   if(['like','skip'].includes(bits[1])){
    if(!selected(id))return 'Aktifkan .smart on dahulu.';
    const category=bits[2];if(!Object.hasOwn(ACTIVITIES,category))return 'Kategori: '+Object.keys(ACTIVITIES).join(' | ');
    const field=bits[1]==='like'?'positive':'negative';
    db.prepare(`INSERT INTO wow_reco_signals(user_id,category,${field},updated_ms) VALUES(?,?,1,?) ON CONFLICT(user_id,category) DO UPDATE SET ${field}=${field}+1,updated_ms=excluded.updated_ms`).run(id,category,now);
    return `🧠 Preferensi ${category} dicatat. Rekomendasi berikutnya menyesuaikan feedback.`;
   }
   if(!bits[1] || ['recommend','rekomendasi'].includes(bits[1]))return recommend(id,now);
   return 'Gunakan .smart on | off | recommend | status | like KATEGORI | skip KATEGORI';
  }
  return null;
 }
 return {dispatch,event,quest,worldStats,playerStats,card,track,selected};
}
