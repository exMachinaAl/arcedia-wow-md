/** WOW v2.3: daily server shop + experimental auction escrow.
 * All mutating commands execute under core.process BEGIN IMMEDIATE.
 * NO topup, cashout, free V transfers, user-listed gacha prizes, or off-platform consideration.
 */
import {createHash} from 'node:crypto';
const WIB=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const GOODS=Object.freeze([
 {sku:'focus-token',kind:'ITEM',price:14,cap:30},
 {sku:'hint-scroll',kind:'ITEM',price:12,cap:30},
 {sku:'copper',kind:'MATERIAL',ore:'Copper',price:8,cap:999},
 {sku:'iron',kind:'MATERIAL',ore:'Iron',price:13,cap:999},
 {sku:'crystal',kind:'MATERIAL',ore:'Crystal',price:22,cap:999}
]);
const GOOD=new Map(GOODS.map(x=>[x.sku,x]));
const keyday=now=>WIB(now).replaceAll('-','');
const hash=text=>createHash('sha256').update(text).digest('hex');
const count=(db,sql,...p)=>Number(db.prepare(sql).get(...p)?.n??0);
const positive=(v,max)=>/^\d{1,4}$/.test(v??'')&&Number(v)>=1&&Number(v)<=max;
const alias=id=>'Player-'+hash(String(id)).slice(0,6).toUpperCase();
const REFUNDS='wow_auction_movements';
export function initWorldMarket(db){
 db.exec(`
 CREATE TABLE IF NOT EXISTS wow_daily_offers(day TEXT NOT NULL,sku TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>0),stock INTEGER NOT NULL CHECK(stock>=0),PRIMARY KEY(day,sku));
 CREATE TABLE IF NOT EXISTS wow_daily_purchases(event_key TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL,sku TEXT NOT NULL,units INTEGER NOT NULL,price_paid INTEGER NOT NULL,created_ms INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_wow_daily_purchases_day ON wow_daily_purchases(user_id,day);
 CREATE TABLE IF NOT EXISTS wow_auctions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,seller_id TEXT NOT NULL REFERENCES users(id),ore TEXT NOT NULL CHECK(ore IN('Copper','Iron','Crystal')),
  units INTEGER NOT NULL CHECK(units BETWEEN 1 AND 5),reserve INTEGER NOT NULL CHECK(reserve BETWEEN 10 AND 500),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','CANCELLED','SETTLED','EXPIRED')),
  bidder_id TEXT REFERENCES users(id),highest_bid INTEGER NOT NULL DEFAULT 0 CHECK(highest_bid BETWEEN 0 AND 500),
  created_ms INTEGER NOT NULL,expires_ms INTEGER NOT NULL,closed_ms INTEGER,
  CHECK((bidder_id IS NULL AND highest_bid=0) OR (bidder_id IS NOT NULL AND highest_bid>0))
 );
 CREATE TABLE IF NOT EXISTS wow_auction_movements(event_key TEXT PRIMARY KEY,auction_id INTEGER NOT NULL REFERENCES wow_auctions(id),user_id TEXT NOT NULL REFERENCES users(id),delta INTEGER NOT NULL,reason TEXT NOT NULL,created_ms INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_wow_auction_status ON wow_auctions(status,expires_ms);
 CREATE INDEX IF NOT EXISTS idx_wow_auction_movements_auction ON wow_auction_movements(auction_id);
 CREATE TABLE IF NOT EXISTS wow_auction_risk_flags(event_key TEXT PRIMARY KEY, auction_id INTEGER NOT NULL REFERENCES wow_auctions(id), bidder_id TEXT NOT NULL REFERENCES users(id),reason TEXT NOT NULL,created_ms INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_wow_auction_risk_flags_created ON wow_auction_risk_flags(created_ms);
 `);
}
export function createWorldMarket({db,auctionEnabled=false,isAuctionEnabled=null,settings=null}){
 const enabled=()=>typeof isAuctionEnabled==='function'?isAuctionEnabled():auctionEnabled;
 const balance=id=>count(db,'SELECT balance AS n FROM wallets WHERE user_id=?',id);
 const qty=(id,g)=>g.kind==='ITEM'?count(db,'SELECT quantity AS n FROM item_stacks WHERE user_id=? AND item_id=?',id,g.sku):count(db,'SELECT quantity AS n FROM wow_materials WHERE user_id=? AND ore=?',id,g.ore);
 const hold=(id,amount)=>db.prepare('UPDATE wallets SET balance=balance-? WHERE user_id=? AND balance>=?').run(amount,id,amount).changes===1;
 const release=(id,amount)=>db.prepare('UPDATE wallets SET balance=balance+? WHERE user_id=?').run(amount,id).changes===1;
 const material=(id,ore,change)=>{
   if(change<0){if(db.prepare('UPDATE wow_materials SET quantity=quantity+? WHERE user_id=? AND ore=? AND quantity>=?').run(change,id,ore,-change).changes!==1)return false;}
   else db.prepare('INSERT INTO wow_materials(user_id,ore,quantity) VALUES(?,?,?) ON CONFLICT(user_id,ore) DO UPDATE SET quantity=quantity+excluded.quantity').run(id,ore,change);
   return true;
 };
 const audit=(auction,id,delta,reason,key,now)=>db.prepare(`INSERT INTO ${REFUNDS}(event_key,auction_id,user_id,delta,reason,created_ms) VALUES(?,?,?,?,?,?)`).run(key,auction,id,delta,reason,now);
 const shopOffers=now=>{
   const day=WIB(now);
   let rows=db.prepare('SELECT day,sku,price,stock FROM wow_daily_offers WHERE day=? ORDER BY sku').all(day);
   if(rows.length)return rows;
   const rotated=GOODS.map(g=>({...g,score:hash('wow-shop-v22:'+day+':'+g.sku)})).sort((a,b)=>a.score.localeCompare(b.score)).slice(0,3);
   for(const g of rotated){const fluct=parseInt(hash('wow-price-v22:'+day+':'+g.sku).slice(0,2),16)%5-2;
     db.prepare('INSERT OR IGNORE INTO wow_daily_offers(day,sku,price,stock) VALUES(?,?,?,?)').run(day,g.sku,Math.max(1,g.price+fluct),120);
   }
   return db.prepare('SELECT day,sku,price,stock FROM wow_daily_offers WHERE day=? ORDER BY sku').all(day);
 };
 const shop=(id,eventKey,parts,now)=>{
   const op=parts[0]??'list',offers=shopOffers(now),day=WIB(now);
   if(op==='list'||op==='help')return `🛒 WOW DAILY SHOP ${day} (WIB)\n${offers.map(x=>`• ${x.sku}: ${x.price} V · stok ${x.stock}`).join('\n')}\n.dailyshop buy SKU [JUMLAH] | .dailyshop history\nLimit ${settings?.get('dailyshop_limit')??3} unit per pemain/hari. Item tidak ditransfer. Reset 00.00 WIB.`;
   if(op==='history'){
     const rows=db.prepare('SELECT sku,units,price_paid,day FROM wow_daily_purchases WHERE user_id=? ORDER BY created_ms DESC LIMIT 8').all(id);
     return rows.length?'🧾 Daily Shop History\n'+rows.map(x=>`${x.day}: ${x.sku} ×${x.units} · ${x.price_paid} V`).join('\n'):'Belum ada pembelian.';
   }
   if(op!=='buy')return 'Gunakan .dailyshop | .dailyshop buy SKU [JUMLAH]';
   const sku=parts[1],g=GOOD.get(sku),units=parts[2]===undefined?1:Number(parts[2]);
   if(!g||!positive(String(parts[2]??1),Math.min(10,Math.max(1,settings?.get('dailyshop_limit')??3))))return 'SKU atau jumlah tidak valid. Cek .dailyshop dan limit server.';
   const offer=offers.find(x=>x.sku===sku);if(!offer)return 'Barang tidak tersedia hari ini.';
   const used=count(db,'SELECT COALESCE(SUM(units),0) AS n FROM wow_daily_purchases WHERE user_id=? AND day=?',id,day);
   if(used+units>(settings?.get('dailyshop_limit')??3))return `Batas pembelian ${settings?.get('dailyshop_limit')??3} unit per pemain per hari.`;
   if(offer.stock<units)return 'Stok harian habis.';
   if(qty(id,g)+units>g.cap)return 'Jumlah item/material akan melebihi kapasitas inventory.';
   const cost=units*offer.price;
   if(!hold(id,cost))return `Saldo tidak cukup. Harga ${cost} V, saldo ${balance(id)} V.`;
   db.prepare('UPDATE wow_daily_offers SET stock=stock-? WHERE day=? AND sku=? AND stock>=?').run(units,day,sku,units);
   if(g.kind==='ITEM'){
      db.prepare('INSERT INTO item_stacks(user_id,item_id,quantity) VALUES(?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=quantity+excluded.quantity').run(id,g.sku,units);
      db.prepare('INSERT INTO item_events(event_key,user_id,item_id,delta,reason,created_ms) VALUES(?,?,?,?,?,?)').run(`dailyshop:item:${eventKey}`,id,g.sku,units,'dailyshop-purchase',now);
   }else material(id,g.ore,units);
   db.prepare('INSERT INTO wow_daily_purchases(event_key,user_id,day,sku,units,price_paid,created_ms) VALUES(?,?,?,?,?,?,?)').run(eventKey,id,day,sku,units,cost,now);
   db.prepare('INSERT INTO wow_v_events(event_key,user_id,delta,reason,day,created_ms) VALUES(?,?,?,?,?,?)').run(`dailyshop:v:${eventKey}`,id,-cost,'dailyshop',day,now);
   return `✅ Dibeli ${sku} ×${units} seharga ${cost} V. Sisa ${balance(id)} V. Stok ${offer.stock-units}.`;
 };
 const active=id=>db.prepare("SELECT id,ore,units,reserve,highest_bid,bidder_id,expires_ms FROM wow_auctions WHERE seller_id=? AND status='OPEN' ORDER BY id DESC LIMIT 6").all(id);
 const eligible=id=>{
   const u=db.prepare('SELECT created_at FROM users WHERE id=?').get(id),p=db.prepare('SELECT plays FROM player_stats WHERE user_id=?').get(id);
   return Boolean(u && p && p.plays>=10 && (Date.now()-Date.parse(u.created_at.replace(' ','T')+'Z'))>=72*3600000);
 };
 const showAuction=now=>{
  const rows=db.prepare("SELECT * FROM wow_auctions WHERE status='OPEN' AND expires_ms>? ORDER BY id DESC LIMIT 12").all(now);
  return rows.length?'🏷️ AUCTION (TEST ONLY)\n'+rows.map(x=>`#${x.id} ${x.ore} ×${x.units} · bid ${x.highest_bid||x.reserve} V · ${alias(x.seller_id)}`).join('\n'):'Belum ada listing aktif.';
 };
 const close=(auction,now,eventKey)=>{
   if(auction.status!=='OPEN')return `Auction #${auction.id}: ${auction.status}.`;
   if(now<auction.expires_ms)return 'Lelang belum berakhir.';
   if(auction.bidder_id){
     // Highest bid already removed from bidder's wallet. On settlement, credit seller minus fixed 5% fee.
     const fee=Math.max(1,Math.ceil(auction.highest_bid*0.05)),net=auction.highest_bid-fee;
     release(auction.seller_id,net);
     material(auction.bidder_id,auction.ore,auction.units);
     audit(auction.id,auction.seller_id,net,'SETTLEMENT',`auction:settle:${auction.id}`,now);
     db.prepare("UPDATE wow_auctions SET status='SETTLED',closed_ms=? WHERE id=? AND status='OPEN'").run(now,auction.id);
     return `✅ Auction #${auction.id} selesai. ${auction.ore} ×${auction.units} diterima pemenang; penjual mendapat ${net} V (fee ${fee} V).`;
   }
   material(auction.seller_id,auction.ore,auction.units);
   db.prepare("UPDATE wow_auctions SET status='EXPIRED',closed_ms=? WHERE id=? AND status='OPEN'").run(now,auction.id);
   return `⌛ Auction #${auction.id} berakhir tanpa bid. Material kembali kepada penjual.`;
 };
 /** Sweep expired auctions atomically. Caller MUST wrap in inTransaction(db,...).
  * This also releases historic escrow when the public feature flag is OFF.
  * Durable auction.status prevents repeated crediting after restarts.
  */
 const sweep=(now=Date.now(),limit=30)=>{
   if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid sweep limit');
   const expired=db.prepare("SELECT * FROM wow_auctions WHERE status='OPEN' AND expires_ms<=? ORDER BY expires_ms,id LIMIT ?").all(now,limit);
   let settled=0,returned=0;
   for(const a of expired){const result=close(a,now,`sweep:${a.id}`);if(result.includes('selesai'))settled++;else returned++;}
   return {processed:expired.length,settled,returned,more:count(db,"SELECT COUNT(*) AS n FROM wow_auctions WHERE status='OPEN' AND expires_ms<=?",now)};
 };
 const auction=(id,key,parts,now)=>{
   if(!enabled())return '🔒 Auction House belum aktif untuk publik. Daily Shop tersedia: .dailyshop. Tidak ada transfer V langsung.';
   const op=parts[0]??'list';
   if(op==='list'||op==='help')return `${showAuction(now)}\n.auction list | .auction mine | .auction sell COPPER|IRON|CRYSTAL JUMLAH HARGA | .auction bid ID V | .auction settle ID | .auction cancel ID\nHanya material aktivitas biasa (bukan item gacha). Fee 5%, tanpa cash-out atau transfer langsung.`;
   if(op==='risk')return `🛡️ WOW AUCTION RISK\nTransaksi ditolak untuk pasangan akun berulang 3 kali/7 hari. Flag audit privat: ${count(db,'SELECT COUNT(*) AS n FROM wow_auction_risk_flags')}\nAuction publik tetap perlu tinjauan manual.`;
   if(op==='mine')return active(id).map(x=>`#${x.id} ${x.ore} ×${x.units} bid ${x.highest_bid}`).join('\n')||'Tidak ada auction aktif.';
   if(op==='sell'){
      const ore=({copper:'Copper',iron:'Iron',crystal:'Crystal'})[parts[1]],u=parts[2],r=parts[3];
      if(!ore||!positive(u,5)||!positive(r,500)||Number(r)<10)return 'Gunakan .auction sell copper|iron|crystal JUMLAH(1–5) HARGA(10–500)';
      if(!eligible(id))return 'Lelang mensyaratkan akun 72 jam dan 10 game dimainkan.';
      if(active(id).length>=2)return 'Maksimal dua listing aktif per penjual.';
      const total=count(db,"SELECT COUNT(*) AS n FROM wow_auctions WHERE seller_id=? AND created_ms>=?",id,now-86400000);
      if(total>=3)return 'Maksimal tiga listing per 24 jam.';
      if(!material(id,ore,-Number(u)))return 'Material tidak cukup.';
      const ref=db.prepare('INSERT INTO wow_auctions(seller_id,ore,units,reserve,created_ms,expires_ms) VALUES(?,?,?,?,?,?)').run(id,ore,Number(u),Number(r),now,now+3600000).lastInsertRowid;
      return `🏷️ Auction #${ref} dibuka: ${ore} ×${u}, minimal ${r} V. Material diamankan sampai lelang selesai.`;
   }
   if(!positive(parts[1],999999))return 'Gunakan ID auction valid.';
   const num=Number(parts[1]),a=db.prepare('SELECT * FROM wow_auctions WHERE id=?').get(num);
   if(!a)return 'Auction tidak ditemukan.';
   if(op==='settle'){
     if(a.seller_id!==id&&a.bidder_id!==id)return 'Hanya peserta lelang yang dapat melakukan settlement.';
     return close(a,now,key);
   }
   if(op==='cancel'){
     if(a.seller_id!==id)return 'Hanya penjual boleh membatalkan.';
     if(a.status!=='OPEN'||a.bidder_id)return 'Auction dengan bid tidak bisa dibatalkan.';
     material(id,a.ore,a.units);
     db.prepare("UPDATE wow_auctions SET status='CANCELLED',closed_ms=? WHERE id=? AND status='OPEN'").run(now,num);
     return `Auction #${num} dibatalkan, material dikembalikan.`;
   }
   if(op!=='bid')return 'Gunakan .auction bid ID JUMLAH | .auction settle ID';
   if(a.status!=='OPEN')return 'Auction sudah tidak aktif.';
   if(now>=a.expires_ms)return 'Lelang telah berakhir. Penjual/pemenang dapat menggunakan .auction settle ID.';
   if(!eligible(id))return 'Bid mensyaratkan akun 72 jam dan 10 game dimainkan.';
   if(a.seller_id===id)return 'Penjual tidak boleh menawar barang sendiri.';
   if(a.bidder_id===id)return 'Bid berulang oleh pemegang tawaran tertinggi tidak didukung.';
   const amount=parts[2];if(!positive(amount,500))return 'Penawaran 1–500 V.';
   const bid=Number(amount),minimum=Math.max(a.reserve,a.highest_bid+5);
   if(bid<minimum)return `Bid minimal ${minimum} V.`;
   // No bids between members of the same guild, to reduce circular transfers.
   const sameGuild=db.prepare('SELECT 1 FROM wow_guild_members m JOIN wow_guild_members n ON n.guild_id=m.guild_id WHERE m.user_id=? AND n.user_id=? LIMIT 1').get(id,a.seller_id);
   if(sameGuild)return 'Untuk keamanan, bid antar anggota guild yang sama tidak tersedia.';
   // Rules-based graph heuristic, NOT a trained ML model. Deny only after two
   // SETTLED auctions between the same buyer/seller within seven days.
   const repetitive=count(db,`SELECT COUNT(*) AS n FROM wow_auctions WHERE status='SETTLED' AND seller_id=? AND bidder_id=? AND closed_ms>=?`,a.seller_id,id,now-7*86400000);
   if(repetitive>=2){
     db.prepare('INSERT OR IGNORE INTO wow_auction_risk_flags(event_key,auction_id,bidder_id,reason,created_ms) VALUES(?,?,?,?,?)').run(`risk:${key}`,num,id,'repeat-counterparty-7d',now);
     return '🛡️ Bid ditahan: pasangan penjual/pembeli terlalu sering bertransaksi dalam 7 hari. Gunakan pemain lain atau hubungi admin.';
   }
   if(!hold(id,bid))return `Saldo tidak cukup untuk bid ${bid} V.`;
   audit(num,id,-bid,'ESCROW_HOLD',`auction:hold:${key}`,now);
   if(a.bidder_id){release(a.bidder_id,a.highest_bid);audit(num,a.bidder_id,a.highest_bid,'ESCROW_REFUND',`auction:refund:${key}`,now);}
   db.prepare('UPDATE wow_auctions SET highest_bid=?,bidder_id=? WHERE id=?').run(bid,id,num);
   return `✅ Bid ${bid} V ditahan untuk Auction #${num}. Jika kalah, escrow otomatis dikembalikan.`;
 };
 function dispatch(id,key,text,now){
    const [cmd,...args]=text.trim().toLowerCase().split(/\s+/);
    if(cmd==='.dailyshop'||cmd==='.dshop')return shop(id,key,args,now);
    if(cmd==='.auction')return auction(id,key,args,now);
    return null;
 }
 const stats=()=>({riskFlags:count(db,'SELECT COUNT(*) AS n FROM wow_auction_risk_flags'),expiredPending:count(db,"SELECT COUNT(*) AS n FROM wow_auctions WHERE status='OPEN' AND expires_ms<=?",Date.now()),shopPurchases:count(db,'SELECT COUNT(*) AS n FROM wow_daily_purchases'),liveAuctions:count(db,"SELECT COUNT(*) AS n FROM wow_auctions WHERE status='OPEN'"),settledAuctions:count(db,"SELECT COUNT(*) AS n FROM wow_auctions WHERE status='SETTLED'"),auctionEnabled:enabled()});
 return {dispatch,stats,shopOffers,sweep};
}
