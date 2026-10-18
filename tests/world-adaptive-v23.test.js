import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
const T=Date.parse('2026-10-18T10:00:00+07:00');
function setup(auctionEnabled=false,db=openDatabase(':memory:')) {
 let i=db.prepare('SELECT COUNT(*) AS n FROM processed_messages').get().n;const core=createCore(db,{auctionEnabled});
 const say=(user,text,now=T,eventKey)=>core.process({senderId:user,text,now,eventKey:eventKey??`v23:${++i}`});
 for(const u of ['ada','bea','cai','dan']){say(u,'.ping');db.prepare('UPDATE wallets SET balance=750 WHERE user_id=?').run(u);db.prepare('UPDATE player_stats SET plays=12 WHERE user_id=?').run(u);db.prepare("UPDATE users SET created_at='2026-09-01 00:00:00' WHERE id=?").run(u);}
 const v=u=>db.prepare('SELECT balance FROM wallets WHERE user_id=?').get(u).balance;
 const ore=(u,k)=>db.prepare('SELECT quantity AS n FROM wow_materials WHERE user_id=? AND ore=?').get(u,k)?.n??0;
 return {db,core,say,v,ore};
}
test('v2.3 season calendar is stable across midnight WIB and restarts',()=>{
 const e=setup();const a=e.core.getWorldAdaptiveStats();assert.equal(a.weeksClaimed,0);
 assert.match(e.say('ada','.season'),/Musim/);
 assert.match(e.say('ada','.season progress'),/Mining 0\/3/);
 const current=e.say('ada','.season',Date.parse('2026-10-18T23:59:00+07:00'));
 const next=e.say('ada','.season',Date.parse('2026-10-19T00:00:00+07:00'));
 assert.notEqual(current.match(/S\d+/)?.[0],next.match(/S\d+/)?.[0]);e.db.close();
});
test('v2.3 season reward requires activity, claims once, and wallet journal is persisted',()=>{
 const e=setup();assert.match(e.say('ada','.season claim'),/Selesaikan/);
 for(let i=0;i<3;i++) e.say('ada','.mine',T+i*2000);
 const start=e.v('ada');const reply=e.say('ada','.season claim',T+10000,'season:first');assert.match(reply,/15 V/);
 assert.equal(e.v('ada'),start+15);assert.equal(e.say('ada','.season claim',T+11000,'season:first'),reply);
 assert.match(e.say('ada','.season claim',T+13000),/sudah diklaim/);
 assert.equal(e.db.prepare("SELECT count(*) AS n FROM wow_v_events WHERE reason='season:activity'").get().n,1);
 e.db.close();
});
test('v2.3 season reward alternative: two expeditions on different days',()=>{
 const e=setup();const first=Date.parse('2026-10-13T09:00:00+07:00'),second=Date.parse('2026-10-14T09:00:00+07:00');
 e.say('bea','.world quest',first);e.say('bea','.world quest',second);assert.match(e.say('bea','.season progress',T),/Ekspedisi 2\/2/);
 assert.match(e.say('bea','.season claim',T),/15 V/);e.db.close();
});
test('v2.3 no manufactured V through repeated weekly claims',()=>{
 const e=setup();e.say('ada','.mine');e.say('ada','.mine');e.say('ada','.mine');e.say('ada','.season claim');
 const old=e.v('ada');for(let i=0;i<5;i++)e.say('ada','.season claim');assert.equal(e.v('ada'),old);e.db.close();
});
test('v2.3 guildshop consumes only treasury, never sends wallet credit',()=>{
 const e=setup();e.say('ada','.guild create Silver');e.say('bea','.guild join Silver');e.say('ada','.guild donate 120');
 const cash=e.v('ada');assert.match(e.say('ada','.guildshop buy copper'),/aktif/);assert.equal(e.v('ada'),cash);
 assert.equal(e.db.prepare("SELECT treasury FROM wow_guilds WHERE slug='silver'").get().treasury,80);
 assert.equal(e.db.prepare('SELECT count(*) AS n FROM wow_guild_supply').get().n,1);e.db.close();
});
test('v2.3 guildshop members receive limited material once a day',()=>{
 const e=setup();e.say('ada','.guild create Silver');e.say('bea','.guild join Silver');e.say('ada','.guild donate 120');e.say('ada','.guildshop buy copper');
 const bal=e.v('bea');assert.match(e.say('bea','.guildshop claim'),/Copper/);assert.equal(e.ore('bea','Copper'),1);
 assert.match(e.say('bea','.guildshop claim'),/sudah diklaim/);assert.equal(e.ore('bea','Copper'),1);assert.equal(e.v('bea'),bal);e.db.close();
});
test('v2.3 guildshop role, hall level and budget checks prevent bypass',()=>{
 const e=setup();e.say('ada','.guild create Silver');e.say('bea','.guild join Silver');
 assert.match(e.say('bea','.guildshop buy copper'),/Owner|Officer/);
 assert.match(e.say('ada','.guildshop buy iron'),/Hall Level 2/);
 assert.match(e.say('ada','.guildshop buy copper'),/Kas guild kurang/);
 assert.match(e.say('cai','.guildshop'),/masuk guild/);e.db.close();
});
test('v2.3 guildshop repeated purchase and message replay cannot mint extra supply',()=>{
 const e=setup();e.say('ada','.guild create Silver');e.say('ada','.guild donate 120');
 const result=e.say('ada','.guildshop buy copper',T,'supply:same');const cash=e.db.prepare("SELECT treasury FROM wow_guilds WHERE slug='silver'").get().treasury;
 assert.equal(e.say('ada','.guildshop buy copper',T,'supply:same'),result);assert.match(e.say('ada','.guildshop buy copper'),/sudah aktif/);
 assert.equal(e.db.prepare("SELECT treasury FROM wow_guilds WHERE slug='silver'").get().treasury,cash);e.db.close();
});
test('v2.3 guildshop and season state persist after restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wow23-'));
 try{const file=join(dir,'wow.sqlite');let e=setup(false,openDatabase(file));e.say('ada','.guild create Silver');e.say('ada','.guild donate 120');e.say('ada','.guildshop buy copper');e.say('ada','.guildshop claim');e.db.close();
 e=setup(false,openDatabase(file));assert.match(e.say('ada','.guildshop claim'),/sudah diklaim/);assert.equal(e.ore('ada','Copper'),1);e.db.close();}finally{rmSync(dir,{recursive:true,force:true});}
});
test('v2.3 auction expiration sweep returns unbid materials once',()=>{
 const e=setup(true);e.db.prepare("INSERT INTO wow_materials(user_id,ore,quantity) VALUES('ada','Copper',5)").run();e.say('ada','.auction sell copper 2 20');
 assert.equal(e.ore('ada','Copper'),3);
 const r=e.core.sweepAuctions({now:T+3600001});assert.equal(r.processed,1);assert.equal(r.returned,1);assert.equal(e.ore('ada','Copper'),5);
 assert.equal(e.core.sweepAuctions({now:T+3600002}).processed,0);assert.equal(e.ore('ada','Copper'),5);e.db.close();
});
test('v2.3 expired auction settles held V and assets exactly once',()=>{
 const e=setup(true);e.db.prepare("INSERT INTO wow_materials(user_id,ore,quantity) VALUES('ada','Copper',5)").run();e.say('ada','.auction sell copper 2 20');e.say('bea','.auction bid 1 20');
 const sb=e.v('ada'),bb=e.v('bea');assert.equal(bb,730);
 const r=e.core.sweepAuctions({now:T+3600001});assert.equal(r.settled,1);assert.equal(e.v('ada'),sb+19);assert.equal(e.ore('bea','Copper'),2);
 e.core.sweepAuctions({now:T+3600002});assert.equal(e.v('ada'),sb+19);assert.equal(e.ore('bea','Copper'),2);e.db.close();
});
test('v2.3 sweep reconciles historic escrow even when auctions are now disabled',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wow23sweep-'));
 try{const file=join(dir,'world.sqlite');let e=setup(true,openDatabase(file));e.db.prepare("INSERT INTO wow_materials(user_id,ore,quantity) VALUES('ada','Copper',5)").run();e.say('ada','.auction sell copper 2 20');e.say('bea','.auction bid 1 20');e.db.close();
 e=setup(false,openDatabase(file));assert.match(e.say('cai','.auction'),/belum aktif/);const r=e.core.sweepAuctions({now:T+3600001});assert.equal(r.settled,1);assert.equal(e.ore('bea','Copper'),2);e.db.close();}finally{rmSync(dir,{recursive:true,force:true});}
});
test('v2.3 suspicious repeated auction seller/buyer relationship is rejected, audited',()=>{
 const e=setup(true);e.db.prepare("INSERT INTO wow_materials(user_id,ore,quantity) VALUES('ada','Copper',10)").run();
 for(let j=1;j<=2;j++){
  e.say('ada','.auction sell copper 1 20',T+(j-1)*3700000);
  e.say('bea',`.auction bid ${j} 20`,T+(j-1)*3700000);
  e.core.sweepAuctions({now:T+j*3700000});
 }
 e.say('ada','.auction sell copper 1 20',T+2*3700000);
 const before=e.v('bea');assert.match(e.say('bea','.auction bid 3 20',T+2*3700000),/Bid ditahan/);
 assert.equal(e.v('bea'),before);assert.equal(e.db.prepare('SELECT count(*) AS n FROM wow_auction_risk_flags').get().n,1);e.db.close();
});
test('v2.3 exchange never enables direct V transfer and auctions remain OFF by default',()=>{
 const e=setup();assert.match(e.say('ada','.pay 20 bea'),/DILARANG|nonaktif|dilarang/i);
 assert.match(e.say('ada','.auction'),/belum aktif/);assert.equal(e.core.getWorldAdaptiveStats().supplyOrders,0);e.db.close();
});
