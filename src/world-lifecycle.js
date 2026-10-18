/** WOW v1.9 – completely fictional, nonredeemable, nontransferable economy.
 * No payments, top-ups, cash-outs, or player-to-player asset/value transfers.
 * Each mutation is wrapped by core.process() BEGIN IMMEDIATE, with message idempotency.
 * Random odds are fixed and public; ML never influences outcomes.
 */
import {randomInt as secureRandom, randomBytes, createHash} from 'node:crypto';
import {forecast} from './economy-intelligence.js';
const DAY = now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const RECIPES=Object.freeze({
 'copper-badge':{name:'Copper Pioneer Badge',resource:'Copper',units:2,cost:15},
 'iron-frame':{name:'Iron Explorer Frame',resource:'Iron',units:2,cost:25},
 'crystal-title':{name:'Crystal World Title',resource:'Crystal',units:2,cost:40}
});
const SHOP=Object.freeze({
 'focus-token':{name:'Focus Token',cost:15,kind:'item',cap:5},
 'hint-scroll':{name:'Hint Scroll',cost:20,kind:'item',cap:5},
 'copper-badge':{name:'Copper Pioneer Badge',cost:60,kind:'collectible'},
 'iron-frame':{name:'Iron Explorer Frame',cost:90,kind:'collectible'},
 'crystal-title':{name:'Crystal World Title',cost:140,kind:'collectible'}
});
const STAKE=5, MAX_ARCADE_STAKE_PER_DAY=25, MAX_ARCADE_WIN_PER_DAY=100;
const SYMBOLS=['🍒','⭐','💎'];
const PAYOUT={3:3,4:7,5:12,6:25,7:35,8:50,9:70,10:100};
const LANES={safe:{chance:7000,prize:6},balanced:{chance:3500,prize:12},legend:{chance:1000,prize:30}};
export function initWorldLifecycle(db){db.exec(`
CREATE TABLE IF NOT EXISTS wow_v_events(event_key TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),delta INTEGER NOT NULL CHECK(delta<>0),reason TEXT NOT NULL,day TEXT NOT NULL,created_ms INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_wow_v_events_daily ON wow_v_events(user_id,day,reason);
CREATE TABLE IF NOT EXISTS wow_collection(user_id TEXT NOT NULL REFERENCES users(id),sku TEXT NOT NULL,acquired_ms INTEGER NOT NULL,PRIMARY KEY(user_id,sku));
CREATE TABLE IF NOT EXISTS wow_material_claims(source_event TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),ore TEXT NOT NULL,claimed_ms INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS wow_materials(user_id TEXT NOT NULL REFERENCES users(id),ore TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>=0),PRIMARY KEY(user_id,ore));
CREATE TABLE IF NOT EXISTS wow_arcade_settings(user_id TEXT PRIMARY KEY REFERENCES users(id),enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)));
CREATE TABLE IF NOT EXISTS wow_arcade_spins(event_key TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL,symbols_json TEXT NOT NULL,run INTEGER NOT NULL,payout INTEGER NOT NULL,created_ms INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_wow_spins_day ON wow_arcade_spins(user_id,day);
CREATE TABLE IF NOT EXISTS wow_v_risk_rooms(code TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL CHECK(status IN('OPEN','DONE','CANCELLED')),created_ms INTEGER NOT NULL,expires_ms INTEGER NOT NULL,draw_value INTEGER,completed_ms INTEGER);
CREATE TABLE IF NOT EXISTS wow_v_risk_entries(room_code TEXT NOT NULL REFERENCES wow_v_risk_rooms(code),user_id TEXT NOT NULL REFERENCES users(id),lane TEXT CHECK(lane IN('safe','balanced','legend')),payout INTEGER NOT NULL DEFAULT 0,joined_ms INTEGER NOT NULL,PRIMARY KEY(room_code,user_id));
CREATE TABLE IF NOT EXISTS wow_careers(user_id TEXT PRIMARY KEY REFERENCES users(id),profession TEXT NOT NULL CHECK(profession IN('miner','artisan','analyst')),last_shift_day TEXT,shifts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS wow_shift_events(user_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL,profession TEXT NOT NULL,reward INTEGER NOT NULL,PRIMARY KEY(user_id,day));
`)}
export function createWorldLifecycle({db,settings=null,randomInt=secureRandom,codeGenerator=()=>randomBytes(4).toString('hex').toUpperCase()}){
 const balance=id=>db.prepare('SELECT balance FROM wallets WHERE user_id=?').get(id)?.balance??0;
 const getCount=(sql,...args)=>Number(db.prepare(sql).get(...args)?.n??0);
 const draw=(min,max)=>{const v=randomInt(min,max);if(!Number.isSafeInteger(v)||v<min||v>=max)throw Error('Invalid RNG');return v;};
 function movement(id,key,delta,reason,now){
   if(!Number.isSafeInteger(delta)||!delta||Math.abs(delta)>10000)throw Error('Invalid V movement');
   if(db.prepare('SELECT 1 FROM wow_v_events WHERE event_key=?').get(key))return 0;
   if(delta<0){if(db.prepare('UPDATE wallets SET balance=balance+? WHERE user_id=? AND balance>=?').run(delta,id,-delta).changes!==1) return null;}
   else db.prepare('UPDATE wallets SET balance=balance+? WHERE user_id=?').run(delta,id);
   db.prepare('INSERT INTO wow_v_events(event_key,user_id,delta,reason,day,created_ms) VALUES(?,?,?,?,?,?)').run(key,id,delta,reason,DAY(now),now);
   return delta;
 }
 function grantItem(id,sku,now){
   if(SHOP[sku]?.kind==='collectible')return db.prepare('INSERT OR IGNORE INTO wow_collection(user_id,sku,acquired_ms) VALUES(?,?,?)').run(id,sku,now).changes===1;
   const current=getCount('SELECT COALESCE(quantity,0) AS n FROM item_stacks WHERE user_id=? AND item_id=?',id,sku);
   const cap=sku==='focus-token'||sku==='hint-scroll'?5:0;
   if(!cap||current>=cap)return false;
   db.prepare('INSERT INTO item_stacks(user_id,item_id,quantity) VALUES(?,?,1) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=quantity+1').run(id,sku);
   db.prepare('INSERT INTO item_events(event_key,user_id,item_id,delta,reason,created_ms) VALUES(?,?,?,?,?,?)').run(`world-item:${id}:${sku}:${now}:${current}`,id,sku,1,'world-v-shop',now);
   return true;
 }
 function claimMaterials(id,now){
   // One resource per pre-existing mining row, claimed once even after an upgrade/restart.
   const rows=db.prepare('SELECT event_key,ore FROM world_mining WHERE user_id=? ORDER BY day,action_no').all(id);
   let earned=0;
   for(const row of rows){
     if(!db.prepare('INSERT OR IGNORE INTO wow_material_claims(source_event,user_id,ore,claimed_ms) VALUES(?,?,?,?)').run(row.event_key,id,row.ore,now).changes)continue;
     db.prepare('INSERT INTO wow_materials(user_id,ore,quantity) VALUES(?,?,1) ON CONFLICT(user_id,ore) DO UPDATE SET quantity=quantity+1').run(id,row.ore);
     earned++;
   }
   return earned;
 }
 function shop(id,args,key,now){
   const op=args[0];
   if(op==='buy'){
     const sku=args[1],p=SHOP[sku];if(!p)return 'Item tidak terdaftar. .vshop';
     if(p.kind==='collectible'&&db.prepare('SELECT 1 FROM wow_collection WHERE user_id=? AND sku=?').get(id,sku))return 'Kosmetik sudah dimiliki.';
     if(p.kind==='item'&&getCount('SELECT COALESCE(quantity,0) AS n FROM item_stacks WHERE user_id=? AND item_id=?',id,sku)>=p.cap)return 'Inventory penuh untuk item tersebut.';
     const taken=movement(id,`shop:${key}`,-p.cost,`shop:${sku}`,now);
     if(taken===null)return `Saldo V tidak cukup. Harga ${p.cost} V, Anda memiliki ${balance(id)} V.`;
     if(!grantItem(id,sku,now))throw Error('Item grant failed: transaction rolled back');
     return `🛍️ Berhasil membeli ${p.name} seharga ${p.cost} V. Saldo ${balance(id)} V. Tidak bisa ditransfer atau diuangkan.`;
   }
   return `🛍️ WOW SHOP — V utama (tanpa uang asli)\n${Object.entries(SHOP).map(([sku,p])=>`${sku}: ${p.cost} V — ${p.name}`).join('\n')}\n.vshop buy NAMA-ITEM\nPendapatan V: .daily, .mine, .career shift, game ranked. Pembelian adalah V sink.`;
 }
 function crafting(id,args,key,now){
   claimMaterials(id,now);
   if(args[0]==='make'){
     const sku=args[1],r=RECIPES[sku];if(!r)return 'Resep tidak ada. Ketik .craft';
     if(db.prepare('SELECT 1 FROM wow_collection WHERE user_id=? AND sku=?').get(id,sku))return 'Item crafting sudah dimiliki.';
     const amount=getCount('SELECT quantity AS n FROM wow_materials WHERE user_id=? AND ore=?',id,r.resource);
     if(amount<r.units)return `Butuh ${r.units} ${r.resource}, tersedia ${amount}. Mining harian memberi material.`;
     const cost=movement(id,`craft:${key}`,-r.cost,`craft:${sku}`,now);
     if(cost===null)return `Butuh ${r.cost} V, saldo Anda ${balance(id)} V.`;
     db.prepare('UPDATE wow_materials SET quantity=quantity-? WHERE user_id=? AND ore=?').run(r.units,id,r.resource);
     if(!db.prepare('INSERT OR IGNORE INTO wow_collection(user_id,sku,acquired_ms) VALUES(?,?,?)').run(id,sku,now).changes)throw Error('Double craft');
     return `🛠️ ${r.name} berhasil dibuat dengan ${r.units} ${r.resource} + ${r.cost} V. Tidak dapat dipindahkan.`;
   }
   const mats=db.prepare('SELECT ore,quantity FROM wow_materials WHERE user_id=? AND quantity>0 ORDER BY ore').all(id);
   return `🛠️ WOW CRAFTING\nMaterial: ${mats.length?mats.map(x=>`${x.ore} ${x.quantity}`).join(', '):'belum ada (.mine)'}\n${Object.entries(RECIPES).map(([sku,r])=>`${sku}: ${r.units} ${r.resource} + ${r.cost} V`).join('\n')}\n.craft make NAMA`;
 }
 function career(id,args,key,now){
   const op=args[0],existing=db.prepare('SELECT * FROM wow_careers WHERE user_id=?').get(id);
   if(op==='choose'){
     const role=args[1];if(!['miner','artisan','analyst'].includes(role))return 'Pilih profesi: miner | artisan | analyst.';
     if(existing)return `Profesi Anda sudah ${existing.profession}. Tidak dapat direset tanpa aturan musim.`;
     db.prepare('INSERT INTO wow_careers(user_id,profession) VALUES(?,?)').run(id,role);
     return `🧰 Profesi ${role} dipilih. Kerjakan .career shift sekali sehari.`;
   }
   if(op==='shift'){
     if(!existing)return 'Pilih profesi dahulu: .career choose miner|artisan|analyst';
     if(existing.last_shift_day===DAY(now))return 'Shift hari ini sudah selesai. Reset 00.00 WIB.';
     const bonus={miner:9,artisan:12,analyst:10}[existing.profession];
     db.prepare('UPDATE wow_careers SET last_shift_day=?,shifts=shifts+1 WHERE user_id=?').run(DAY(now),id);
     db.prepare('INSERT INTO wow_shift_events(user_id,day,profession,reward) VALUES(?,?,?,?)').run(id,DAY(now),existing.profession,bonus);
     movement(id,`career:${id}:${DAY(now)}`,bonus,`career:${existing.profession}`,now);
     return `💼 Shift ${existing.profession} selesai! +${bonus} V. Saldo ${balance(id)} V.`;
   }
   return `💼 KARIER WOW\nProfesi: ${existing?.profession??'belum dipilih'}\nTotal shift: ${existing?.shifts??0}\n.career choose miner|artisan|analyst\n.career shift (sekali sehari, V gratis)`;
 }
 const spendCap=()=>settings?.get('arcade_spend_limit')??MAX_ARCADE_STAKE_PER_DAY;
 const winCap=()=>settings?.get('arcade_win_limit')??MAX_ARCADE_WIN_PER_DAY;
 function optedIn(id){return db.prepare('SELECT enabled FROM wow_arcade_settings WHERE user_id=?').get(id)?.enabled===1;}
 function dailySpend(id,now){return -getCount("SELECT COALESCE(SUM(delta),0) AS n FROM wow_v_events WHERE user_id=? AND day=? AND reason LIKE 'arcade-stake:%'",id,DAY(now));}
 function dailyWins(id,now){return getCount("SELECT COALESCE(SUM(delta),0) AS n FROM wow_v_events WHERE user_id=? AND day=? AND reason LIKE 'arcade-win:%'",id,DAY(now));}
 function canStake(id,now){
   if(!optedIn(id))return `Mode V Arcade perlu opt-in: .arcade v enable. Batas ${spendCap()} V/hari, tidak ada uang asli.`;
   if(dailySpend(id,now)+STAKE>spendCap())return `Batas pengeluaran Arcade ${spendCap()} V/hari tercapai.`;
   if(balance(id)<STAKE)return `Saldo tidak cukup: perlu ${STAKE} V. Anda bisa mining atau bekerja gratis.`;
   return null;
 }
 function creditWin(id,key,amount,reason,now){
   const actual=Math.max(0,Math.min(amount,winCap()-dailyWins(id,now)));
   if(actual>0)movement(id,key,actual,`arcade-win:${reason}`,now);
   return actual;
 }
 function slot(id,key,now){
   const blocked=canStake(id,now);if(blocked)return blocked;
   movement(id,`arcade-bet:${key}`,-STAKE,'arcade-stake:slot',now);
   const symbols=Array.from({length:10},()=>SYMBOLS[draw(0,SYMBOLS.length)]);
   let run=1,best=1;for(let i=1;i<symbols.length;i++){run=symbols[i]===symbols[i-1]?run+1:1;best=Math.max(best,run);}
   const wanted=PAYOUT[best]??0;
   const win=creditWin(id,`arcade-win:${key}`,wanted,'slot',now);
   db.prepare('INSERT INTO wow_arcade_spins(event_key,user_id,day,symbols_json,run,payout,created_ms) VALUES(?,?,?,?,?,?,?)').run(key,id,DAY(now),JSON.stringify(symbols),best,win,now);
   return `🎰 SYMBOL MATCH V (biaya ${STAKE} V)\n${symbols.join(' | ')}\nKecocokan terpanjang: ${best}/10. Hadiah ${win} V${win<wanted?' (dibatasi kuota harian)':''}.\nSaldo ${balance(id)} V. Pengeluaran hari ini ${dailySpend(id,now)}/${spendCap()} V.\nPeluang tetap, tidak dimanipulasi ML. .slot v odds`;
 }
 function vRisk(id,args,key,now){
   const op=args[0]??'help',code=(args[1]??'').toUpperCase();
   if(op==='help'||op==='odds')return `🎯 RISK ROOMS V — pilihan peluang tetap\nBiaya masuk ${STAKE} V/pemain; safe 70%→6 V; balanced 35%→12 V; legend 10%→30 V.\n2–4 pemain, satu angka undian bersama, tidak ada transfer/pot antarpemain. Hadiah dari engine.\n.risk v create | join KODE | choose KODE safe|balanced|legend | resolve KODE | status KODE | cancel KODE\nRoom tanpa hasil dapat dibatalkan/refund; non-tunai, tanpa top-up/cash-out.`;
   if(op==='create'){
     const blocked=canStake(id,now);if(blocked)return blocked;
     const created=getCount('SELECT COUNT(*) AS n FROM wow_v_risk_rooms WHERE owner_id=? AND created_ms>=?',id,Date.parse(DAY(now)+'T00:00:00+07:00'));
     if(created>=2)return 'Maksimal 2 room V per hari.';
     let keyCode=null;
     for(let i=0;i<6;i++){const c=codeGenerator();if(/^[A-F0-9]{8}$/.test(c)&&!db.prepare('SELECT 1 FROM wow_v_risk_rooms WHERE code=?').get(c)){keyCode=c;break;}}
     if(!keyCode)throw Error('Room code allocation failed');
     movement(id,`vroom-entry:${keyCode}:${id}`,-STAKE,'arcade-stake:risk',now);
     db.prepare("INSERT INTO wow_v_risk_rooms(code,owner_id,status,created_ms,expires_ms) VALUES(?,?,'OPEN',?,?)").run(keyCode,id,now,now+30*60000);
     db.prepare('INSERT INTO wow_v_risk_entries(room_code,user_id,joined_ms) VALUES(?,?,?)').run(keyCode,id,now);
     return `🎯 Risk Room V ${keyCode} dibuat. Biaya ${STAKE} V dicatat. Undang 1–3 pemain lain: .risk v join ${keyCode}\nPilih jalur: .risk v choose ${keyCode} safe|balanced|legend`;
   }
   if(op==='clean'){
     const old=db.prepare("SELECT code FROM wow_v_risk_rooms WHERE status='OPEN' AND expires_ms<=? LIMIT 100").all(now);
     for(const item of old)refund(item.code,now,'expired');
     return `Bersihkan ${old.length} room kedaluwarsa; peserta mendapat refund.`;
   }
   if(!/^[A-F0-9]{8}$/.test(code))return 'Kode room harus 8 karakter heksadesimal.';
   const room=db.prepare('SELECT * FROM wow_v_risk_rooms WHERE code=?').get(code);
   if(!room)return 'Room tidak ditemukan.';
   if(room.status==='OPEN'&&room.expires_ms<=now)refund(code,now,'expired');
   const latest=db.prepare('SELECT * FROM wow_v_risk_rooms WHERE code=?').get(code);
   const members=()=>db.prepare('SELECT user_id,lane,payout FROM wow_v_risk_entries WHERE room_code=? ORDER BY joined_ms').all(code);
   if(op==='status'){
     if(!db.prepare('SELECT 1 FROM wow_v_risk_entries WHERE room_code=? AND user_id=?').get(code,id))return 'Hanya peserta yang dapat melihat room ini.';
     return `🎯 ROOM ${code} • ${latest.status}\nPeserta ${members().length}/4, memilih ${members().filter(x=>x.lane).length}\n${members().map(x=>`P-${createHash('sha256').update(x.user_id).digest('hex').slice(0,6)}: ${x.lane??'belum pilih'}${latest.status==='DONE'?` +${x.payout} V`:''}`).join('\n')}`;
   }
   if(latest.status!=='OPEN')return `Room sudah ${latest.status}.`;
   if(op==='cancel'){
     if(latest.owner_id!==id)return 'Hanya pemilik bisa membatalkan room.';
     refund(code,now,'cancelled');return 'Room dibatalkan. Seluruh biaya masuk telah dikembalikan.';
   }
   if(op==='join'){
     if(db.prepare('SELECT 1 FROM wow_v_risk_entries WHERE room_code=? AND user_id=?').get(code,id))return 'Anda sudah bergabung.';
     if(members().length>=4)return 'Room penuh.';
     const blocked=canStake(id,now);if(blocked)return blocked;
     movement(id,`vroom-entry:${code}:${id}`,-STAKE,'arcade-stake:risk',now);
     db.prepare('INSERT INTO wow_v_risk_entries(room_code,user_id,joined_ms) VALUES(?,?,?)').run(code,id,now);
     return `Berhasil bergabung! Pilih jalur: .risk v choose ${code} safe|balanced|legend`;
   }
   if(op==='choose'){
     const lane=args[2];if(!LANES[lane])return 'Pilih safe | balanced | legend';
     const change=db.prepare('UPDATE wow_v_risk_entries SET lane=? WHERE room_code=? AND user_id=?').run(lane,code,id);
     return change.changes?`Pilihan ${lane} tersimpan, peluang ${LANES[lane].chance/100}%`:'Bukan anggota room.';
   }
   if(op==='resolve'){
     if(latest.owner_id!==id)return 'Hanya pemilik dapat menyelesaikan room.';
     const list=members();if(list.length<2)return 'Perlu minimal 2 pemain.';
     if(list.some(x=>!x.lane))return 'Semua peserta wajib memilih terlebih dulu.';
     const roll=draw(0,10000);
     db.prepare("UPDATE wow_v_risk_rooms SET status='DONE',draw_value=?,completed_ms=? WHERE code=? AND status='OPEN'").run(roll,now,code);
     const results=[];
     for(const m of list){
       const due=roll<LANES[m.lane].chance?LANES[m.lane].prize:0;
       const win=creditWin(m.user_id,`vroom-win:${code}:${m.user_id}`,due,'risk',now);
       db.prepare('UPDATE wow_v_risk_entries SET payout=? WHERE room_code=? AND user_id=?').run(win,code,m.user_id);
       results.push(`${m.user_id===id?'Anda':'Peserta '+(results.length+1)} (${m.lane}): +${win} V`);
     }
     return `🏁 ROOM ${code} selesai. Undian bersama ${roll}/9999.\n${results.join('\n')}\nTidak ada transfer uang atau V antarpemain.`;
   }
   return 'Gunakan .risk v help';
 }
 function refund(code,now,reason){
   const update=db.prepare("UPDATE wow_v_risk_rooms SET status='CANCELLED',completed_ms=? WHERE code=? AND status='OPEN'").run(now,code);
   if(!update.changes)return;
   const members=db.prepare('SELECT user_id FROM wow_v_risk_entries WHERE room_code=?').all(code);
   for(const m of members)movement(m.user_id,`vroom-refund:${code}:${m.user_id}`,STAKE,`arcade-refund:${reason}`,now);
 }
 function dispatch(id,key,text,now){
   const p=text.trim().toLowerCase().split(/\s+/),cmd=p[0],args=p.slice(1);
   if(cmd==='.vshop')return shop(id,args,key,now);
   if(cmd==='.market'&&args[0]==='forecast'){const symbol=(args[1]??'NOVA').toUpperCase(),result=forecast(symbol,now);return result?`🧠 WOW MARKET ML (${symbol}) — DATA FIKTIF\nPrediksi harga sintetis besok: ${result.nextSyntheticEstimate} V\nModel dipilih: ${result.model}\nBacktest MAE regresi ${result.evaluation.modelMAE}, baseline ${result.evaluation.baselineMAE}\nTanpa hubungan pasar nyata, bukan nasihat investasi.`:'Simbol hanya NOVA, AQUA, ORBI.';}
   if(cmd==='.craft')return crafting(id,args,key,now);
   if(cmd==='.career')return career(id,args,key,now);
   if(cmd==='.collection' && args[0]==='wow'){
     const rows=db.prepare('SELECT sku FROM wow_collection WHERE user_id=? ORDER BY sku').all(id);
     return `🏛️ WOW COLLECTION ${rows.length} item\n${rows.length?rows.map(x=>x.sku).join('\n'):'Belum ada. .craft dan .vshop'}`;
   }
   if(cmd==='.arcade'&&args[0]==='v'){
     if(args[1]==='enable'||args[1]==='disable'){
       db.prepare('INSERT INTO wow_arcade_settings(user_id,enabled) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled').run(id,args[1]==='enable'?1:0);
       return args[1]==='enable'?`V Arcade aktif (simulasi non-tunai). Pengeluaran maksimal ${spendCap()} V/hari.`:'V Arcade dinonaktifkan untuk akun ini.';
     }
     return `🎰 V Arcade: ${optedIn(id)?'ON':'OFF'}\nSaldo ${balance(id)} V. Staking simulasi max ${spendCap()} V/hari, hadiah max ${winCap()} V/hari.\n.arcade v enable|disable\n.slot v (biaya 5 V)\n.risk v help (room multiplayer biaya 5 V)\nTidak ada uang nyata atau cash-out. Transfer hanya jika admin mengaktifkan.`;
   }
   if(cmd==='.slot'&&args[0]==='v'){
     if(args[1]==='odds')return `🎰 Symbol Match V • 10 posisi, 3 simbol masing-masing peluang 1/3, independen. Rentetan terpanjang menentukan payout:\n${Object.entries(PAYOUT).map(([k,v])=>`${k} cocok → ${v} V`).join(' | ')}\nKurang dari 3 = 0 V. Biaya main 5 V, max ${spendCap()} V stake/hari dan max ${winCap()} V hadiah/hari. Odds bersifat tetap.`;
     return slot(id,key,now);
   }
   if(cmd==='.risk'&&args[0]==='v')return vRisk(id,args.slice(1),key,now);
   if(cmd==='.wow'&&args[0]==='economy')return `🌍 WOW ECONOMY\nSaldo ${balance(id)} V. Aktivitas: .mine | .work | .career | .vshop | .craft | .arcade v\nNon-transferable, no top-up, no cash-out. Semua aktivitas direkam.`;
   if(cmd==='.wow'&&args[0]==='audit'){
     const rows=db.prepare('SELECT delta,reason,day FROM wow_v_events WHERE user_id=? ORDER BY created_ms DESC LIMIT 10').all(id);
     return `📒 Riwayat V baru (v1.9):\n${rows.length?rows.map(x=>`${x.delta>0?'+':''}${x.delta} V ${x.reason} (${x.day})`).join('\n'):'Belum ada transaksi v1.9'}`;
   }
   return null;
 }
 function stats(){
   const moved=db.prepare('SELECT COALESCE(SUM(CASE WHEN delta>0 THEN delta ELSE 0 END),0) AS minted, COALESCE(SUM(CASE WHEN delta<0 THEN -delta ELSE 0 END),0) AS burned FROM wow_v_events').get();
   return {mintedV:moved.minted,burnedV:moved.burned,netV:moved.minted-moved.burned,paidSpins:getCount('SELECT COUNT(*) AS n FROM wow_arcade_spins'),crafted:getCount('SELECT COUNT(*) AS n FROM wow_collection'),careers:getCount('SELECT COUNT(*) AS n FROM wow_careers'),transferEnabled:false};
 }
 return {dispatch,stats,recipes:RECIPES,shop:SHOP};
}
