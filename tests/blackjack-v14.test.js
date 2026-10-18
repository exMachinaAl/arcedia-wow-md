import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {createRuntime} from '../src/runtime.js';
import {evaluateHand,makeShoe} from '../src/blackjack.js';
import {createBlackjackNotifier} from '../src/wa/blackjack-notifier.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';

const A='62811111111@s.whatsapp.net',B='62822222222@s.whatsapp.net',C='62833333333@s.whatsapp.net',G='1200000000000@g.us';
const fixture=(file=':memory:')=>{const db=openDatabase(file),core=createCore(db);let index=0;
 return {db,core,send:(u,t,context={})=>core.process({senderId:u,text:t,context,eventKey:`BJ-T-${++index}`}),getRoom:()=>db.prepare('SELECT * FROM bj_rooms ORDER BY created_at DESC LIMIT 1').get()};};
const code=s=>s.match(/[0-9A-F]{8}/)?.[0];

test('v1.4 blackjack ace scoring handles soft/hard and natural blackjack',()=>{
 assert.deepEqual(evaluateHand(['AS','9D']),{total:20,soft:true,blackjack:false,bust:false});
 assert.equal(evaluateHand(['AS','9D','5H']).total,15);
 assert.equal(evaluateHand(['AS','KH']).blackjack,true);
 assert.equal(evaluateHand(['KD','QD','5S']).bust,true);
});
test('v1.4 secure shoe has 4 complete shuffled decks',()=>{
 const shoe=makeShoe(i=>i-1);assert.equal(shoe.length,208);assert.equal(shoe.filter(x=>x==='AS').length,4);
});
test('v1.4 private room join, host-only start, and persisted private hands',()=>{
 const x=fixture();try{const room=code(x.send(A,'.bj create'));assert.ok(room);
  assert.match(x.send(B,`.bj join ${room}`),/Masuk blackjack/);
  assert.match(x.send(B,'.bj start'),/host/);
  assert.match(x.send(A,'.bj start'),/dimulai/);
  const r=x.getRoom(),roster=x.db.prepare('SELECT * FROM bj_seats WHERE room_id=?').all(room);
  assert.equal(r.status,'ACTIVE');assert.equal(roster.length,2);assert.equal(JSON.parse(roster[0].hand).length,2);
  assert.match(x.send(B,'.bj hand'),/Kartu Anda/);
 }finally{x.db.close();}
});
test('v1.4 cannot inspect other player cards or mutate room without membership',()=>{
 const x=fixture();try{const id=code(x.send(A,'.bj create'));x.send(B,`.bj join ${id}`);x.send(A,'.bj start');
   assert.match(x.send(C,`.bj status ${id}`),/bukan peserta/);
   assert.match(x.send(C,`.bj hit ${id}`),/bukan peserta/);
   const response=x.send(A,'.bj status');const b=x.db.prepare('SELECT hand FROM bj_seats WHERE room_id=? AND user_id=?').get(id,B);
   assert.equal(response.includes(JSON.stringify(b.hand)),false);
 }finally{x.db.close();}
});
test('v1.4 group table exposes invitation only, cards and Hit/Stand private',()=>{
 const x=fixture();try{const msg=x.send(A,'.bj group',{chatId:G,isGroup:true}),id=code(msg);
   assert.ok(id);assert.match(msg,/grup/);
   assert.match(x.send(B,`.bj join ${id}`),/Masuk blackjack/);
   assert.match(x.send(B,'.bj start'),/dimulai/);
   const publicText=x.send(A,`.bj board ${id}`,{chatId:G,isGroup:true});
   // A natural blackjack may end automatically on the deal; only an ACTIVE room hides the dealer hole card.
   if(/ACTIVE/.test(publicText))assert.match(publicText,/kartu tertutup|🂠/i);
   else assert.match(publicText,/DONE/);
   assert.doesNotMatch(publicText,/Kartu Anda|Kartu privat pemain/);
   assert.match(x.send(A,'.bj hit',{chatId:G,isGroup:true}),/hanya di DM/);
 }finally{x.db.close();}
});
test('v1.4 room reaches DONE only after all players stand or bust; stats persist',()=>{
 const x=fixture();try{const id=code(x.send(A,'.bj create'));x.send(B,`.bj join ${id}`);x.send(A,'.bj start');
   for(const u of [A,B]){let guard=0;while(x.db.prepare('SELECT state FROM bj_seats WHERE room_id=? AND user_id=?').get(id,u).state==='PLAY' && guard++<16) x.send(u,'.bj stand');}
   assert.equal(x.getRoom().status,'DONE');
   assert.equal(x.db.prepare('SELECT COUNT(*) n FROM bj_seats WHERE room_id=? AND result IS NOT NULL').get(id).n,2);
   assert.equal(x.core.getBlackjackStats().done,1);
   assert.match(x.send(A,'.bj status'),/DONE/);
 }finally{x.db.close();}
});
test('v1.4 duplicate WhatsApp event key never draws a second card',()=>{
 const x=fixture();try{const id=code(x.send(A,'.bj create'));x.send(A,'.bj start');
   const first=x.core.process({senderId:A,eventKey:'same-live-wa-id',text:'.bj hit'});
   const room1=x.db.prepare('SELECT shoe FROM bj_rooms WHERE id=?').get(id).shoe;
   const second=x.core.process({senderId:A,eventKey:'same-live-wa-id',text:'.bj hit'});
   assert.equal(first,second);assert.equal(x.db.prepare('SELECT shoe FROM bj_rooms WHERE id=?').get(id).shoe,room1);
 }finally{x.db.close();}
});
test('v1.4 graceful shutdown survives 1h downtime and preserves exact shoe state',()=>{
 const dir=mkdtempSync(join(tmpdir(),'waw14-'));const file=join(dir,'game.sqlite');let now=1000000;
 try {let x=fixture(file),rt=createRuntime(x.db,{clock:()=>now});rt.start();
   const id=code(x.send(A,'.bj create'));x.send(B,`.bj join ${id}`);x.send(A,'.bj start');const before=x.getRoom();const shoe=before.shoe;
   rt.stop();x.db.close();now+=60*60*1000;
   x=fixture(file);const next=createRuntime(x.db,{clock:()=>now});const resume=next.start();
   assert.equal(resume.pausedMs,60*60*1000);
   const restored=x.db.prepare('SELECT * FROM bj_rooms WHERE id=?').get(id);
   assert.equal(restored.shoe,shoe);assert.equal(restored.expires_at,before.expires_at+3600000);
   assert.match(x.core.process({senderId:A,text:'.bj hand',eventKey:'resume-new-msg'}),/Kartu Anda/);
   next.stop();x.db.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('v1.4 crash recovery respects lease and pauses clock after stale heartbeat',()=>{
 const x=fixture(),base=1_000_000;try{
   const first=createRuntime(x.db,{clock:()=>base});first.start();
   const second=createRuntime(x.db,{clock:()=>base+2000});assert.throws(()=>second.start(),/already running/);
   const third=createRuntime(x.db,{clock:()=>base+3600000});assert.equal(third.start().pausedMs,3600000);
   third.stop();
 }finally{x.db.close();}
});
test('v1.4 blackjack outbox retries failures and ACKs after successful delivery',async()=>{
 const x=fixture();try{const id=code(x.send(A,'.bj create'));x.send(A,'.bj start');
  const events=x.db.prepare('SELECT COUNT(*) n FROM bj_notices WHERE room_id=?').get(id).n;assert.ok(events>=1);
  let failures=0;const notifier=createBlackjackNotifier({core:x.core,sendText:async()=>{if(failures++===0)throw Error('offline');}});
  const first=await notifier.flush(Date.now());assert.ok(first.failed>=1);
  const second=await notifier.flush(Date.now()+600000);assert.ok(second.sent>=1);
  assert.equal(x.db.prepare('SELECT COUNT(*) n FROM bj_notices WHERE delivered_at IS NULL').get().n,0);
 }finally{x.db.close();}
});
test('v1.4 WhatsApp group handler only permits safe blackjack group actions',async()=>{
 const x=fixture();try{const output=[];
  const handler=createWhatsAppHandler({core:x.core,sendText:async(j,t)=>output.push({j,t}),sendButtons:async()=>({sent:true}),allowGroups:true});
  await handler({key:{remoteJid:G,participant:A,id:'gr1'},message:{conversation:'.bj group'}});
  assert.match(output[0].t,/MEJA BLACKJACK GRUP/);
  await handler({key:{remoteJid:G,participant:A,id:'gr2'},message:{conversation:'.bj hit'}});
  assert.match(output[1].t,/hanya di DM/);
 }finally{x.db.close();}
});

test('v1.4 private card PNG renders and never grants nonparticipant access',()=>{
 const x=fixture();try{const id=code(x.send(A,'.bj create'));x.send(B,`.bj join ${id}`);x.send(A,'.bj start');
   const own=x.core.getBlackjackImage({senderId:A});assert.ok(own?.png?.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
   assert.match(own.caption,/Kartu Anda/);
   assert.equal(x.core.getBlackjackImage({senderId:C}),null);
 }finally{x.db.close();}
});
test('v1.4 group start notifications preserve card privacy and DM hand image handler',async()=>{
 const x=fixture();try{
  const id=code(x.send(A,'.bj group',{chatId:G,isGroup:true}));x.send(B,`.bj join ${id}`);x.send(B,'.bj start');
  const group=x.db.prepare('SELECT body FROM bj_notices WHERE room_id=? AND recipient=?').all(id,G);
  assert.ok(group.length>=1);assert.ok(group.every(x=>!x.body.includes('Kartu Anda:')));
  let result=null;const handle=createWhatsAppHandler({core:x.core,sendText:async()=>{},sendImage:async(jid,bytes,caption)=>{result={jid,bytes,caption}},sendButtons:async()=>({sent:true}),allowGroups:true});
  await handle({key:{remoteJid:B,id:'bjimg-v14'},message:{conversation:'.bj hand'}});
  assert.equal(result?.jid,B);assert.ok(result.bytes.length>1000);
 }finally{x.db.close();}
});
