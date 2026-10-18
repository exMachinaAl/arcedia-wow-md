/** WOW v2.3 — deterministic seasons, guild supply, and transparent economic policy.
 * Mutations are called by createCore.process inside a SQLite BEGIN IMMEDIATE transaction.
 * Neither a direct V transfer nor a paid/random reward is introduced here.
 */
const WIB=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const number=(db,sql,...params)=>Number(db.prepare(sql).get(...params)?.n??0);
const BASE=Date.parse('2026-10-12T00:00:00+07:00');
const week=(now)=>{
  const date=WIB(now);const today=Date.parse(date+'T00:00:00+07:00');
  const n=Math.floor((today-BASE)/604800000);
  return {key:`S${String(n).padStart(5,'0')}`,start:WIB(BASE+n*604800000),n};
};
const EDITIONS=['Musim Ekspedisi','Musim Penambang','Musim Pengrajin','Musim Penjelajah'];
export function initWorldAdaptive(db){
 db.exec(`
 CREATE TABLE IF NOT EXISTS wow_season_claims(user_id TEXT NOT NULL REFERENCES users(id),season_key TEXT NOT NULL, reward INTEGER NOT NULL CHECK(reward BETWEEN 1 AND 30),claimed_ms INTEGER NOT NULL,PRIMARY KEY(user_id,season_key));
 CREATE TABLE IF NOT EXISTS wow_guild_supply(guild_id INTEGER NOT NULL REFERENCES wow_guilds(id),day TEXT NOT NULL,ore TEXT NOT NULL CHECK(ore IN('Copper','Iron')),
  cost INTEGER NOT NULL CHECK(cost BETWEEN 1 AND 200),created_ms INTEGER NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(guild_id,day));
 CREATE TABLE IF NOT EXISTS wow_guild_supply_claims(guild_id INTEGER NOT NULL REFERENCES wow_guilds(id),user_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL,ore TEXT NOT NULL,created_ms INTEGER NOT NULL,PRIMARY KEY(user_id,day));
 CREATE INDEX IF NOT EXISTS idx_wow_guild_supply_claims_guild ON wow_guild_supply_claims(guild_id,day);
 `);
}
export function createWorldAdaptive({db}){
 const supplyStats=()=>({weeksClaimed:number(db,'SELECT count(*) AS n FROM wow_season_claims'),supplyOrders:number(db,'SELECT count(*) AS n FROM wow_guild_supply'),supplyClaims:number(db,'SELECT count(*) AS n FROM wow_guild_supply_claims')});
 const seasonInfo=(now)=>{
  const s=week(now),edition=EDITIONS[((s.n%EDITIONS.length)+EDITIONS.length)%EDITIONS.length];
  return {...s,name:edition,ends:WIB(BASE+(s.n+1)*604800000)};
 };
 const season=(id,key,args,now)=>{
  const s=seasonInfo(now),day=WIB(now),op=args[0]??'info';
  if(op==='info'||op==='help')return `🌎 WOW SEASON ${s.key}: ${s.name}\nBerakhir minggu berikutnya (${s.ends} WIB).\nHadiah pencapaian 15 V, sekali per musim. Syarat: 3 mining ATAU 2 ekspedisi dunia sepanjang musim.\n.season progress | .season claim`;
  const begin=BASE+s.n*604800000,end=begin+604800000;
  const days=Array.from({length:7},(_,i)=>new Date(begin+i*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'}));
  const mines=number(db,`SELECT count(*) AS n FROM world_mining WHERE user_id=? AND day IN (${days.map(()=>'?').join(',')})`,id,...days);
  const quests=number(db,`SELECT count(*) AS n FROM wow_world_quests WHERE user_id=? AND day IN (${days.map(()=>'?').join(',')})`,id,...days);
  const claimed=Boolean(db.prepare('SELECT 1 FROM wow_season_claims WHERE user_id=? AND season_key=?').get(id,s.key));
  if(op==='progress')return `🏅 ${s.name} (${s.key})\nMining ${mines}/3 · Ekspedisi ${quests}/2\nReward 15 V: ${claimed?'sudah diklaim':mines>=3||quests>=2?'SIAP':'belum tercapai'}.`;
  if(op!=='claim')return 'Gunakan .season | .season progress | .season claim';
  if(claimed)return 'Reward musim ini sudah diklaim. Satu kali setiap musim.';
  if(mines<3&&quests<2)return `Selesaikan 3 mining (${mines}/3) atau 2 ekspedisi (${quests}/2) sebelum klaim.`;
  db.prepare('INSERT INTO wow_season_claims(user_id,season_key,reward,claimed_ms) VALUES(?,?,15,?)').run(id,s.key,now);
  db.prepare('UPDATE wallets SET balance=balance+15 WHERE user_id=?').run(id);
  db.prepare('INSERT INTO wow_v_events(event_key,user_id,delta,reason,day,created_ms) VALUES(?,?,?,?,?,?)').run(`season:${id}:${s.key}`,id,15,'season:activity',day,now);
  return `🏅 ${s.name}: reward 15 V diterima! Season ${s.key}, hanya sekali. Sisa saldo ${number(db,'SELECT balance AS n FROM wallets WHERE user_id=?',id)} V.`;
 };
 const guildshop=(id,key,args,now)=>{
  const op=args[0]??'info';const day=WIB(now);
  const g=db.prepare('SELECT m.guild_id,m.role,g.slug,g.treasury,g.hall_level FROM wow_guild_members m JOIN wow_guilds g ON g.id=m.guild_id WHERE m.user_id=? AND g.closed=0').get(id);
  if(!g)return 'Anda harus masuk guild aktif sebelum menggunakan .guildshop.';
  const order=db.prepare('SELECT ore,cost FROM wow_guild_supply WHERE guild_id=? AND day=?').get(g.guild_id,day);
  if(op==='info'||op==='list'||op==='help')return `🏰 GUILD SUPPLY ${g.slug} — ${day}\nKas ${g.treasury} V · Hall Lv.${g.hall_level}\nPaket hari ini: ${order?`${order.ore} (aktif)`: 'belum dibeli'}.\nOwner/Officer dapat mengaktifkan Copper (40 V, Hall 1+) atau Iron (60 V, Hall 2+).\n.guildshop buy copper|iron | .guildshop claim\nSetiap anggota mengambil 1 material/hari, tanpa transfer V.`;
  if(op==='buy'){
   if(!['OWNER','OFFICER'].includes(g.role))return 'Hanya Owner atau Officer yang boleh membeli supply.';
   if(order)return 'Supply guild hari ini sudah aktif; maksimal 1 pembelian/hari.';
   const ore=({copper:'Copper',iron:'Iron'})[args[1]];
   if(!ore)return 'Pilih .guildshop buy copper|iron';
   if(ore==='Iron'&&g.hall_level<2)return 'Supply Iron membutuhkan Hall Level 2.';
   const cost=ore==='Copper'?40:60;
   if(g.treasury<cost)return `Kas guild kurang (${g.treasury}/${cost} V). Donasi melalui .guild donate.`;
   db.prepare('UPDATE wow_guilds SET treasury=treasury-? WHERE id=? AND treasury>=?').run(cost,g.guild_id,cost);
   db.prepare('INSERT INTO wow_guild_supply(guild_id,day,ore,cost,created_ms,actor_id) VALUES(?,?,?,?,?,?)').run(g.guild_id,day,ore,cost,now,id);
   db.prepare('INSERT INTO wow_guild_history(event_key,guild_id,actor_id,kind,amount,created_ms) VALUES(?,?,?,?,?,?)').run(`guildshop:${key}`,g.guild_id,id,'SUPPLY',cost,now);
   return `📦 ${ore} Guild Supply aktif! Kas berkurang ${cost} V. Setiap anggota dapat klaim 1 ${ore} hari ini.`;
  }
  if(op==='claim'){
   if(!order)return 'Guild belum membeli paket Supply untuk hari ini.';
   if(db.prepare('SELECT 1 FROM wow_guild_supply_claims WHERE user_id=? AND day=?').get(id,day))return 'Supply hari ini sudah diklaim oleh akun Anda.';
   db.prepare('INSERT INTO wow_guild_supply_claims(guild_id,user_id,day,ore,created_ms) VALUES(?,?,?,?,?)').run(g.guild_id,id,day,order.ore,now);
   db.prepare('INSERT INTO wow_materials(user_id,ore,quantity) VALUES(?,?,1) ON CONFLICT(user_id,ore) DO UPDATE SET quantity=quantity+1').run(id,order.ore);
   return `📦 +1 ${order.ore} diterima dari Guild Supply. Tidak ada transfer V antar anggota.`;
  }
  return 'Gunakan .guildshop | .guildshop buy copper|iron | .guildshop claim';
 };
 function dispatch(id,key,text,now){const [cmd,...args]=text.trim().toLowerCase().split(/\s+/);if(cmd==='.season')return season(id,key,args,now);if(cmd==='.guildshop')return guildshop(id,key,args,now);return null;}
 return {dispatch,stats:supplyStats,seasonInfo};
}
