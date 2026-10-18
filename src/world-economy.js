/** WOW (World of WA) v1.7 simulation economy.
 * All value is fictional, no top-up/cash-out/exchange to real goods, no paid bets.
 * Random arcade grants only BOUND V; spendable V is earned from non-wagered activity.
 * The fictional market quotes are deterministic synthetic data, NEVER real securities.
 */
import {createHash} from 'node:crypto';
export const DAY = now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const ASSETS=Object.freeze({NOVA:{name:'Nova Energy',base:42},AQUA:{name:'Aqua World',base:27},ORBI:{name:'Orbit Labs',base:67}});
const MINING_PER_DAY=3;
const BOUND_DAILY_CAP=40;
const SHOP=Object.freeze({
 'arcade-title':{name:'Arcade Explorer Title',cost:25},
 'arcade-frame':{name:'Cosmic Profile Frame',cost:35}
});
const safeCount=x=>Number.isSafeInteger(x)&&x>0&&x<=10;
function quote(symbol,now){
 const asset=ASSETS[symbol];if(!asset)return null;
 const date=DAY(now),hash=createHash('sha256').update(`wow-world-synthetic-v1:${symbol}:${date}`).digest();
 const variance=hash.readUInt16BE(0)%15-7;
 return {symbol,name:asset.name,price:asset.base+variance,variance,day:date};
}
export function initWorldEconomy(db){
 db.exec(`
 CREATE TABLE IF NOT EXISTS world_starters(user_id TEXT PRIMARY KEY REFERENCES users(id),claimed_ms INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS world_mining(user_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL,action_no INTEGER NOT NULL CHECK(action_no BETWEEN 1 AND 3),ore TEXT NOT NULL,reward INTEGER NOT NULL, event_key TEXT NOT NULL UNIQUE,PRIMARY KEY(user_id,day,action_no));
 CREATE TABLE IF NOT EXISTS world_jobs(user_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL,event_key TEXT NOT NULL UNIQUE,PRIMARY KEY(user_id,day));
 CREATE TABLE IF NOT EXISTS world_market_holdings(user_id TEXT NOT NULL REFERENCES users(id),symbol TEXT NOT NULL CHECK(symbol IN ('NOVA','AQUA','ORBI')),shares INTEGER NOT NULL CHECK(shares BETWEEN 0 AND 50),PRIMARY KEY(user_id,symbol));
 CREATE TABLE IF NOT EXISTS world_market_trades(id INTEGER PRIMARY KEY AUTOINCREMENT,event_key TEXT NOT NULL UNIQUE,user_id TEXT NOT NULL REFERENCES users(id),symbol TEXT NOT NULL,side TEXT NOT NULL CHECK(side IN('BUY','SELL')),shares INTEGER NOT NULL CHECK(shares BETWEEN 1 AND 10),unit_price INTEGER NOT NULL,amount INTEGER NOT NULL,day TEXT NOT NULL,created_ms INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_world_trades_day ON world_market_trades(user_id,day);
 CREATE TABLE IF NOT EXISTS world_wallet_movements(event_key TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),delta INTEGER NOT NULL CHECK(delta<>0),reason TEXT NOT NULL,created_ms INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS world_bound_wallets(user_id TEXT PRIMARY KEY REFERENCES users(id),balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0));
 CREATE TABLE IF NOT EXISTS world_bound_events(event_key TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL,delta INTEGER NOT NULL CHECK(delta<>0),reason TEXT NOT NULL,created_ms INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_bound_daily ON world_bound_events(user_id,day,delta);
 CREATE TABLE IF NOT EXISTS world_shop_purchases(user_id TEXT NOT NULL REFERENCES users(id),item_id TEXT NOT NULL,event_key TEXT NOT NULL UNIQUE,created_ms INTEGER NOT NULL,PRIMARY KEY(user_id,item_id));
 `);
}
export function createWorldEconomy({db,credit}) {
 const balance=id=>db.prepare('SELECT balance FROM wallets WHERE user_id=?').get(id)?.balance??0;
 const boundBalance=id=>db.prepare('SELECT balance FROM world_bound_wallets WHERE user_id=?').get(id)?.balance??0;
 const holdings=id=>db.prepare('SELECT symbol,shares FROM world_market_holdings WHERE user_id=? AND shares>0 ORDER BY symbol').all(id);
 function grantBound(id,eventKey,now,requested,reason){
   if(!Number.isSafeInteger(requested)||requested<0||requested>1000)throw Error('Invalid bound credit');
   if(db.prepare('SELECT 1 FROM world_bound_events WHERE event_key=?').get(eventKey))return 0;
   const day=DAY(now);
   const daily=db.prepare('SELECT COALESCE(SUM(delta),0) AS n FROM world_bound_events WHERE user_id=? AND day=? AND delta>0').get(id,day).n;
   const amount=Math.max(0,Math.min(requested,BOUND_DAILY_CAP-daily));
   if(!amount)return 0;
   db.prepare('INSERT INTO world_bound_wallets(user_id,balance) VALUES(?,0) ON CONFLICT(user_id) DO NOTHING').run(id);
   db.prepare('INSERT INTO world_bound_events(event_key,user_id,day,delta,reason,created_ms) VALUES(?,?,?,?,?,?)').run(eventKey,id,day,amount,reason,now);
   db.prepare('UPDATE world_bound_wallets SET balance=balance+? WHERE user_id=?').run(amount,id);
   return amount;
 }
 function wallet(id){
   return `💰 WOW WALLET\nV-Currency utama: ${balance(id)} V (dari aktivitas & simulasi pasar)\nArcade V terikat: ${boundBalance(id)} V (hanya untuk kosmetik)\nTidak ada top-up, cash-out, atau nilai uang nyata.\nDapatkan V: .wow starter | .daily | .mine | .work\nPasar fiktif: .market | Kosmetik: .wow shop`;
 }
 function intro(id,now){
   const day=DAY(now),mine=db.prepare('SELECT COUNT(*) AS n FROM world_mining WHERE user_id=? AND day=?').get(id,day).n;
   const starter=!!db.prepare('SELECT 1 FROM world_starters WHERE user_id=?').get(id);
   return `🌍 WOW — WORLD OF WA\nSaldo: ${balance(id)} V utama + ${boundBalance(id)} V arcade terikat\n🎁 Starter: ${starter?'SUDAH':'TERSEDIA — .wow starter'}\n⛏️ Mining: ${MINING_PER_DAY-mine}/${MINING_PER_DAY} hari ini (.mine)\n🧰 Pekerjaan: .work complete (sekali/hari)\n📈 Bursa virtual: .market\n🎰 Arcade: .arcade (free) / .arcade v (simulasi pakai V, opt-in)\n🛍️ Kosmetik: .wow shop\n💼 Dompet: .wow wallet\nRanked/Casual, V Shop dan crafting sudah tersedia. Transfer V hanya melalui .transfer jika admin mengaktifkan (default OFF).`;
 }
 function starter(id,eventKey,now){
   if(db.prepare('SELECT 1 FROM world_starters WHERE user_id=?').get(id))return 'Starter WOW sudah diklaim untuk akun ini.';
   db.prepare('INSERT INTO world_starters(user_id,claimed_ms) VALUES(?,?)').run(id,now);
   const amount=credit(id,75,'wow-starter',`wow:starter:${id}`,now);
   return `🎉 Selamat datang di WOW! +${amount} V-Currency untuk memulai kehidupan kedua. Klaim satu kali per akun.`;
 }
 function mine(id,eventKey,now){
   const day=DAY(now);
   const used=db.prepare('SELECT COUNT(*) AS n FROM world_mining WHERE user_id=? AND day=?').get(id,day).n;
   if(used>=MINING_PER_DAY)return `⛏️ Energi mining hari ini habis (3/3). Reset 00.00 WIB. Tidak bisa membeli energi.`;
   // Guaranteed, bounded, skill-neutral income; not a random wager.
   const ores=[['Copper',6],['Iron',8],['Crystal',10]];
   const [ore,amount]=ores[used];
   db.prepare('INSERT INTO world_mining(user_id,day,action_no,ore,reward,event_key) VALUES(?,?,?,?,?,?)').run(id,day,used+1,ore,amount,eventKey);
   const issued=credit(id,amount,'wow-mining',`wow:mine:${id}:${day}:${used+1}`,now);
   return `⛏️ Tambang ${ore}! +${issued} V-Currency. Energi ${used+1}/${MINING_PER_DAY}. Saldo sekarang ${balance(id)} V.`;
 }
 function work(id,eventKey,now){
   const day=DAY(now);
   if(db.prepare('SELECT 1 FROM world_jobs WHERE user_id=? AND day=?').get(id,day))return '🧰 Pekerjaan harian sudah selesai. Kembali besok (WIB).';
   db.prepare('INSERT INTO world_jobs(user_id,day,event_key) VALUES(?,?,?)').run(id,day,eventKey);
   const issued=credit(id,12,'wow-work',`wow:work:${id}:${day}`,now);
   return `🧰 Pekerjaan virtual selesai! +${issued} V. Kesempatan berikutnya besok.`;
 }
 function market(id,eventKey,args,now){
   const op=(args[0]??'list').toLowerCase();
   if(op==='list'||op==='help')return `📈 BURSA FIKTIF WOW — ${DAY(now)}\n${Object.keys(ASSETS).map(s=>{const q=quote(s,now);return `${s} ${q.name}: ${q.price} V/saham`}).join('\n')}\n.market buy NOVA 1 | .market sell NOVA 1\n.market portfolio | .market outlook\nHarga hasil algoritma sintetis harian; tidak berhubungan dengan saham sungguhan. Saldo V virtual dapat naik atau turun.`;
   if(op==='outlook')return `🧠 MARKET OUTLOOK (HEURISTIK, BUKAN ML TERLATIH)\n${Object.keys(ASSETS).map(s=>{const q=quote(s,now);return `${s}: ${q.variance>=0?'di atas':'di bawah'} harga dasar (${q.variance>=0?'+':''}${q.variance} V)`}).join('\n')}\nTidak memprediksi pasar nyata; ML berbasis histori pemain masih roadmap.`;
   if(op==='portfolio'){
     const list=holdings(id),value=list.reduce((n,h)=>n+h.shares*quote(h.symbol,now).price,0);
     return `💼 PORTOFOLIO VIRTUAL\n${list.length?list.map(h=>`${h.symbol}: ${h.shares} lembar (nilai simulasi ${h.shares*quote(h.symbol,now).price} V)`).join('\n'):'Belum punya aset.'}\nNilai portofolio: ${value} V; tunai: ${balance(id)} V. Harga dapat berubah besok.`;
   }
   if(!['buy','sell'].includes(op))return 'Gunakan .market list | buy SIMBOL JUMLAH | sell SIMBOL JUMLAH | portfolio | outlook';
   const symbol=(args[1]??'').toUpperCase(),count=Number(args[2]);
   if(!ASSETS[symbol]||!safeCount(count)||!/^[1-9]\d?$/.test(args[2]??''))return 'Gunakan .market buy NOVA 1 (simbol NOVA/AQUA/ORBI, 1–10 lembar per transaksi).';
   const q=quote(symbol,now),amount=q.price*count;
   const owned=db.prepare('SELECT shares FROM world_market_holdings WHERE user_id=? AND symbol=?').get(id,symbol)?.shares??0;
   if(op==='buy'){
     if(owned+count>50)return 'Batas kepemilikan 50 lembar per simbol.';
     const spentToday=db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM world_market_trades WHERE user_id=? AND day=? AND side='BUY'").get(id,DAY(now)).n;
     if(spentToday+amount>250)return 'Batas pembelian pasar virtual 250 V/hari tercapai.';
     if(balance(id)<amount)return `Saldo tidak cukup (${amount} V). Mining dan pekerjaan gratis tersedia.`;
   } else if(owned<count)return `Saham virtual ${symbol} tidak cukup. Dimiliki: ${owned}.`;
   const delta=op==='buy'?-amount:amount;
   // Negative debit requires conditional update; both balances and holdings are inside caller's transaction.
   if(delta<0){
     if(!db.prepare('UPDATE wallets SET balance=balance+? WHERE user_id=? AND balance>=?').run(delta,id,-delta).changes)throw Error('Balance changed concurrently');
   } else db.prepare('UPDATE wallets SET balance=balance+? WHERE user_id=?').run(delta,id);
   if(op==='buy')db.prepare('INSERT INTO world_market_holdings(user_id,symbol,shares) VALUES(?,?,?) ON CONFLICT(user_id,symbol) DO UPDATE SET shares=shares+excluded.shares').run(id,symbol,count);
   else db.prepare('UPDATE world_market_holdings SET shares=shares-? WHERE user_id=? AND symbol=? AND shares>=?').run(count,id,symbol,count);
   db.prepare('INSERT INTO world_market_trades(event_key,user_id,symbol,side,shares,unit_price,amount,day,created_ms) VALUES(?,?,?,?,?,?,?,?,?)').run(eventKey,id,symbol,op.toUpperCase(),count,q.price,amount,DAY(now),now);
   db.prepare('INSERT INTO world_wallet_movements(event_key,user_id,delta,reason,created_ms) VALUES(?,?,?,?,?)').run(eventKey,id,delta,`fictional-market-${op}`,now);
   return `📈 ${op==='buy'?'MEMBELI':'MENJUAL'} ${count} ${symbol} @ ${q.price} V; perubahan saldo ${delta>0?'+':''}${delta} V. Saldo ${balance(id)} V. Tidak terkait pasar saham nyata.`;
 }
 function shop(id,eventKey,args,now){
   if(!args[0]||args[0]==='list')return `🛍️ WOW ARCADE SHOP (saldo terikat)\n${Object.entries(SHOP).map(([key,x])=>`${key}: ${x.cost} V terikat — ${x.name}`).join('\n')}\n.wow buy arcade-title | .wow buy arcade-frame\nTidak ada kotak acak/pembelian peluang.`;
   const sku=args[0],item=SHOP[sku];if(!item)return 'Item tidak ada. .wow shop';
   if(db.prepare('SELECT 1 FROM world_shop_purchases WHERE user_id=? AND item_id=?').get(id,sku))return 'Kosmetik sudah dimiliki.';
   const used=db.prepare('UPDATE world_bound_wallets SET balance=balance-? WHERE user_id=? AND balance>=?').run(item.cost,id,item.cost);
   if(!used.changes)return `Arcade V terikat kurang. Perlu ${item.cost} V, saldo ${boundBalance(id)} V.`;
   db.prepare('INSERT INTO world_shop_purchases(user_id,item_id,event_key,created_ms) VALUES(?,?,?,?)').run(id,sku,eventKey,now);
   db.prepare('INSERT INTO world_bound_events(event_key,user_id,day,delta,reason,created_ms) VALUES(?,?,?,?,?,?)').run(eventKey,id,DAY(now),-item.cost,'cosmetic-shop',now);
   return `✅ ${item.name} telah masuk ke koleksi WOW (kosmetik permanen). Saldo terikat ${boundBalance(id)} V.`;
 }
 function dispatch(id,eventKey,text,now){
   const [cmd,...args]=text.trim().split(/\s+/),lower=cmd.toLowerCase();
   if(lower==='.wow'){
     const op=(args[0]??'').toLowerCase();
     if(op==='starter')return starter(id,eventKey,now);
     if(op==='wallet')return wallet(id);
     if(op==='shop')return shop(id,eventKey,[],now);
     if(op==='buy')return shop(id,eventKey,[args[1]],now);
     if(op==='collection'){
       const owned=db.prepare('SELECT item_id FROM world_shop_purchases WHERE user_id=? ORDER BY item_id').all(id).map(x=>x.item_id);
       return `🏛️ Koleksi WOW: ${owned.length} kosmetik\n${owned.length?owned.join('\n'):'Belum ada. .wow shop'}`;
     }
     return intro(id,now);
   }
   if(lower==='.mine')return args[0]?.toLowerCase()==='status'?intro(id,now):mine(id,eventKey,now);
   if(lower==='.work')return work(id,eventKey,now);
   if(lower==='.market')return market(id,eventKey,args,now);
   return null;
 }
 const stats=()=>({starters:db.prepare('SELECT COUNT(*) AS n FROM world_starters').get().n,mined:db.prepare('SELECT COUNT(*) AS n FROM world_mining').get().n,marketTrades:db.prepare('SELECT COUNT(*) AS n FROM world_market_trades').get().n,boundIssued:db.prepare('SELECT COALESCE(SUM(delta),0) AS n FROM world_bound_events WHERE delta>0').get().n});
 return {dispatch,grantBound,boundBalance,wallet,stats};
}
