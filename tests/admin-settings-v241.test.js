import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';
const NOW=Date.now();
const ADMIN='628123450000@s.whatsapp.net', ALICE='alice@s.whatsapp.net', BOB='bob@s.whatsapp.net';
function setup(location=':memory:') {
 const db=openDatabase(location),core=createCore(db,{adminIds:[ADMIN]}),id={n:0};
 const say=(user,text,{key,now=NOW,context}={})=>core.process({senderId:user,text,eventKey:key??`control:${++id.n}`,now,context});
 for(const [u,nick] of [[ADMIN,'Superadmin'],[ALICE,'Alpha'],[BOB,'Beta']])say(u,`.nick ${nick}`);
 return {db,core,say};
}
const balance=(db,id)=>db.prepare('SELECT balance FROM wallets WHERE user_id=?').get(id)?.balance??0;
const mature=db=>{for(const u of [ADMIN,ALICE,BOB]){db.prepare("UPDATE users SET created_at='2026-01-01 00:00:00' WHERE id=?").run(u);db.prepare('UPDATE player_stats SET plays=20 WHERE user_id=?').run(u);}};
test('v2.4.1 exact admin JID required, no nickname spoofing, private only',()=>{
 const a=setup();
 assert.match(a.say(ALICE,'.admin show'),/Akses ditolak/);
 assert.match(a.say(ALICE,'.admin grant me 999'),/Akses ditolak/);
 assert.match(a.say(ALICE,'.admin set auction on'),/Akses ditolak/);
 assert.match(a.say(ADMIN,'.admin show',{context:{isGroup:true}}),/hanya tersedia melalui DM/);
 assert.match(a.say(ADMIN,'.admin show'),/auction: OFF/);
 assert.match(a.say(ALICE,'.whoami'),/alice@s.whatsapp.net/);
 assert.equal(balance(a.db,ALICE),0);a.db.close();
});
test('v2.4.1 admins can toggle auction live; nonadmins cannot',()=>{
 const a=setup();mature(a.db);
 a.db.prepare("INSERT INTO wow_materials(user_id,ore,quantity) VALUES(?,?,?)").run(ALICE,'Copper',4);
 assert.match(a.say(ALICE,'.auction sell copper 2 20'),/belum aktif/);
 assert.match(a.say(ADMIN,'.admin set auction on'),/auction.*0 → 1/);
 assert.match(a.say(ALICE,'.auction sell copper 2 20'),/Auction #1/);
 assert.match(a.say(ADMIN,'.admin set auction off'),/1 → 0/);
 assert.match(a.say(ALICE,'.auction sell copper 1 20'),/belum aktif/);
 assert.equal(a.db.prepare('SELECT COUNT(*) AS n FROM wow_auctions').get().n,1);a.db.close();
});
test('v2.4.1 grant money idempotent, amount limits, user permissions and audit',()=>{
 const a=setup();const key='same-grant-001';
 const first=a.say(ADMIN,'.admin grant Alpha 500',{key});assert.match(first,/\+500 V/);
 assert.equal(a.say(ADMIN,'.admin grant Alpha 500',{key}),first);
 assert.equal(balance(a.db,ALICE),500);
 assert.match(a.say(ADMIN,'.admin grant Alpha 60000'),/Jumlah 1/);
 assert.match(a.say(ADMIN,'.admin grant nobody 10'),/Target tidak dikenal/);
 assert.match(a.say(ADMIN,'.admin grant me 777'),/\+777 V/);
 assert.equal(balance(a.db,ADMIN),777);
 assert.match(a.say(ALICE,'.admin grant me 5000'),/Akses ditolak/);
 assert.match(a.say(ADMIN,'.admin audit'),/GRANT/);
 assert.equal(a.db.prepare('SELECT COUNT(*) AS n FROM wow_admin_grants').get().n,2);
 a.db.close();
});
test('v2.4.1 configurable arcade caps enforce spend/wins and shop limit',()=>{
 const a=setup();a.say(ADMIN,'.admin grant Alpha 300');
 assert.match(a.say(ADMIN,'.admin set arcade_spend_limit 0'),/0/);
 a.say(ALICE,'.arcade v enable');assert.match(a.say(ALICE,'.slot v'),/Batas pengeluaran Arcade 0/);
 assert.match(a.say(ADMIN,'.admin set arcade_spend_limit 10'),/10/);
 a.say(ALICE,'.slot v');a.say(ALICE,'.slot v');
 assert.match(a.say(ALICE,'.slot v'),/Batas pengeluaran Arcade 10/);
 a.say(ALICE,'.dailyshop');let offer=a.db.prepare('SELECT sku FROM wow_daily_offers LIMIT 1').get().sku;
 assert.match(a.say(ADMIN,'.admin set dailyshop_limit 1'),/1/);
 assert.match(a.say(ALICE,`.dailyshop buy ${offer} 1`),/Dibeli/);
 assert.match(a.say(ALICE,`.dailyshop buy ${offer} 1`),/Batas pembelian/);
 assert.match(a.say(ADMIN,'.admin set arcade_win_limit 1500'),/Batas.*0–1000/);
 a.db.close();
});
test('v2.4.1 transfer OFF by default with db-level guard; legacy pay stays blocked',()=>{
 const a=setup();a.say(ADMIN,'.admin grant Alpha 100');
 assert.match(a.say(ALICE,'.transfer Beta 10'),/OFF/);
 assert.match(a.say(ALICE,'.pay Beta 10'),/DILARANG/);
 assert.throws(()=>a.db.prepare('INSERT INTO wow_safe_transfers(event_key,sender_id,receiver_id,amount,created_ms) VALUES(?,?,?,?,?)').run('sql:try',ALICE,BOB,10,NOW),/disabled by admin/);
 assert.equal(balance(a.db,ALICE),100);a.db.close();
});
test('v2.4.1 controlled transfer requires maturity, caps, cooldown, no group',()=>{
 const a=setup();a.say(ADMIN,'.admin grant Alpha 250');a.say(ADMIN,'.admin set transfer on');
 assert.match(a.say(ALICE,'.transfer Beta 20'),/72 jam/);
 mature(a.db);
 assert.match(a.say(ALICE,'.transfer Beta 20',{context:{isGroup:true}}),/hanya tersedia melalui DM/);
 assert.match(a.say(ALICE,'.transfer Beta 50'),/Transfer 50 V/);
 assert.equal(balance(a.db,ALICE),200);assert.equal(balance(a.db,BOB),50);
 assert.match(a.say(ALICE,'.transfer Beta 10'),/sekali per jam/);
 assert.match(a.say(ALICE,'.transfer Beta 51'),/Jumlah 1–50/);
 assert.match(a.say(ADMIN,'.admin set transfer off'),/1 → 0/);
 assert.match(a.say(ALICE,'.transfer Beta 10',{now:NOW+2*3600000}),/OFF/);
 assert.equal(a.db.prepare('SELECT COUNT(*) AS n FROM wow_safe_transfers').get().n,1);
 assert.equal(balance(a.db,ALICE)+balance(a.db,BOB),250);
 a.db.close();
});
test('v2.4.1 admin settings, V balance and flags survive a server restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wow-admin-'));const path=join(dir,'world.sqlite');
 try{
  let a=setup(path);a.say(ADMIN,'.admin set auction on');a.say(ADMIN,'.admin set transfer on');a.say(ADMIN,'.admin set arcade_spend_limit 75');a.say(ADMIN,'.admin grant Alpha 999');a.db.close();
  a=setup(path);assert.match(a.say(ADMIN,'.admin show',{key:'restart:show:one'}),/auction: ON/);assert.match(a.say(ADMIN,'.admin show',{key:'restart:show:two'}),/transfer: ON/);assert.match(a.say(ADMIN,'.admin show',{key:'restart:show:three'}),/arcade_spend_limit: 75/);
  assert.equal(balance(a.db,ALICE),999);a.db.close();
 }finally{rmSync(dir,{force:true,recursive:true});}
});
test('v2.4.1 WhatsApp group blocks admin commands before core processing',async()=>{
 const a=setup();const messages=[];
 const handle=createWhatsAppHandler({core:a.core,allowGroups:true,sendText:async(_jid,text)=>messages.push(text),sendButtons:async()=>({sent:true})});
 const msg={key:{id:'one',remoteJid:'group@g.us',participant:ADMIN},message:{conversation:'.admin set auction on'}};
 const result=await handle(msg);assert.equal(result.ignored,'social-private-only');
 assert.match(messages.join(' '),/hanya tersedia di chat pribadi/);
 assert.match(a.say(ADMIN,'.admin show'),/auction: OFF/);a.db.close();
});
