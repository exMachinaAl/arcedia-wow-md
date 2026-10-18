import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {createWorldIntelligence} from '../src/world-intelligence.js';
import {renderPlayerCard} from '../src/world/player-card-png.js';
const T=Date.parse('2026-10-18T11:00:00+07:00');
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'wow20-')),file=join(dir,'world.sqlite');let db=openDatabase(file),core=createCore(db,{randomInt:()=>0}),i=0;
 return {get db(){return db;},get core(){return core;},say:(id,text,now=T,key)=>core.process({senderId:id,eventKey:key??`m${++i}`,text,now}),reopen(){db.close();db=openDatabase(file);core=createCore(db,{randomInt:()=>0});},close(){db.close();rmSync(dir,{recursive:true,force:true});}};
}
function check(title,fn){test('World v2.0: '+title,()=>{const f=fixture();try{fn(f);}finally{f.close();}})}
const balance=(f,id)=>f.db.prepare('SELECT balance FROM wallets WHERE user_id=?').get(id)?.balance??0;
check('event persists across restart with same proof',f=>{
 const before=f.say('a','.world audit');const daily=f.say('b','.world event');
 f.reopen();assert.equal(f.say('a','.world audit'),before);assert.equal(f.say('b','.world event'),daily);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM wow_day_events').get().n,1);
});
check('new WIB day generates a new row once',f=>{
 f.say('a','.world event',T);f.say('a','.world event',T+86400_000);f.say('a','.world event',T+86400_000);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM wow_day_events').get().n,2);
});
check('world event does not consume injected chance RNG',f=>{
 assert.match(f.say('a','.world event'),/WORLD EVENT/);
 assert.match(f.say('a','.coin kepala'),/Koin: kepala/);
});
check('world quests award 8 V once, including replay',f=>{
 const value=createWorldIntelligence({db:f.db}).event(T).reward;
 const first=f.say('a','.world quest',T,'quest-a');assert.match(first,new RegExp('\\+'+value+' V'));
 assert.equal(f.say('a','.world quest',T,'quest-a'),first);
 assert.match(f.say('a','.world quest'),/sudah diklaim/);assert.equal(balance(f,'a'),value);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM wow_world_quests').get().n,1);
});
check('world quests persist and reset next day',f=>{
 const first=createWorldIntelligence({db:f.db}).event(T).reward;
 f.say('a','.world quest');f.reopen();assert.match(f.say('a','.world quest'),/sudah diklaim/);
 const second=createWorldIntelligence({db:f.db}).event(T+86400000).reward;
 assert.match(f.say('a','.world quest',T+86400000),/Ekspedisi selesai/);assert.equal(balance(f,'a'),first+second);
});
check('personal stats reflect mining, games, wallet',f=>{
 f.say('a','.mine');f.say('a','.coin kepala');const txt=f.say('a','.stats');
 assert.match(txt,/Win rate/);assert.match(txt,/Mining 1/);assert.match(txt,/WORLD|WOW PLAYER CARD/);
});
check('aggregate stats omit raw user ids',f=>{
 f.say('rare.phone.123','.mine');const stats=f.say('rare.phone.123','.stats world');
 assert.match(stats,/Total saldo/);assert.doesNotMatch(stats,/rare.phone.123/);
});
check('recommender defaults off and collects nothing',f=>{
 assert.match(f.say('a','.smart recommend'),/nonaktif/);
 f.say('a','.mine');assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM wow_reco_signals').get().n,0);
});
check('opt-in tracks category only not full chat text',f=>{
 f.say('a','.smart on');f.say('a','.mine');f.say('a','.market');
 const data=f.db.prepare('SELECT category,uses FROM wow_reco_signals ORDER BY category').all();
 assert.deepEqual(data.map(x=>[x.category,x.uses]),[['market',1],['mining',1]]);
});
check('replayed user message creates one learning signal',f=>{
 f.say('a','.smart on');f.say('a','.mine',T,'idem-1');f.say('a','.mine',T,'idem-1');
 assert.equal(f.db.prepare("SELECT uses FROM wow_reco_signals WHERE user_id='a' AND category='mining'").get().uses,1);
});
check('recommendation uses recorded feedback and scoring',f=>{
 f.say('a','.smart on');for(let i=0;i<12;i++)f.say('a','.smart like mining');
 for(let i=0;i<12;i++)f.say('a','.smart skip arcade');
 const result=f.say('a','.smart recommend');assert.match(result,/Mining: .mine/);assert.match(result,/online-learning/);
});
check('opt-out deletes learning data and disables further tracking',f=>{
 f.say('a','.smart on');f.say('a','.market');f.say('a','.smart like market');f.say('a','.smart off');
 f.say('a','.market');
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM wow_reco_signals').get().n,0);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM wow_reco_event_keys').get().n,0);
 assert.match(f.say('a','.smart status'),/OFF/);
});
check('feedback category must be whitelisted',f=>{
 f.say('a','.smart on');assert.match(f.say('a','.smart like hacked'),/Kategori/);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM wow_reco_signals').get().n,0);
});
check('persistent learning after restart',f=>{
 f.say('a','.smart on');f.say('a','.market');f.reopen();assert.match(f.say('a','.smart status'),/ON/);
 assert.equal(f.db.prepare("SELECT uses FROM wow_reco_signals WHERE user_id='a' AND category='market'").get().uses,1);
});
check('PNG player card is a real image with meaningful dimensions',f=>{
 f.say('a','.wow starter');const img=f.core.getPlayerCardImage({senderId:'a'}).png;
 assert.equal(img.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(img.readUInt32BE(16),640);assert.equal(img.readUInt32BE(20),350);
});
check('no transfer or top-up reenabled by new module',f=>{
 f.say('a','.world quest');assert.match(f.say('a','.pay b 5'),/DILARANG/);assert.equal(balance(f,'a'),createWorldIntelligence({db:f.db}).event(T).reward);
});
check('multi-user quests are independent, no wallet transfer',f=>{
 const value=createWorldIntelligence({db:f.db}).event(T).reward;f.say('a','.world quest');f.say('b','.world quest');assert.equal(balance(f,'a'),value);assert.equal(balance(f,'b'),value);
});
test('World v2.0: private WhatsApp PNG player card + native event buttons, no group leak',async()=>{
 const {createWhatsAppHandler}=await import('../src/wa/handler.js');
 const {PANELS,BUTTON_COMMANDS}=await import('../src/wa/buttons.js');
 const db=openDatabase(':memory:');
 try{
  const core=createCore(db);let png=null,panel=null;
  const handle=createWhatsAppHandler({core,sendText:async()=>{},sendButtons:async(j,m,q,opts)=>{panel=opts?.panelName;return {sent:true}},sendImage:async(j,bytes,caption)=>{png=bytes;},allowGroups:true});
  const msg=(text,id,jid='a@s.whatsapp.net')=>({key:{remoteJid:jid,id,fromMe:false},message:{conversation:text}});
  await handle(msg('.stats card','stats-card'));assert.ok(Buffer.isBuffer(png));assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  await handle(msg('.world event','world-event'));assert.equal(panel,'worldintel');
  assert.equal(PANELS.worldintel.buttons.length,3);assert.equal(BUTTON_COMMANDS['waw:wi:stats'],'.stats card');
  const denied=await handle(msg('.stats card','blocked','group@g.us'));assert.equal(denied.ignored,'social-private-only');
 }finally{db.close();}
});
