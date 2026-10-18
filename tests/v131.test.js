import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {createChessNotifier} from '../src/wa/chess-notifier.js';
import {PANELS,BUTTON_COMMANDS} from '../src/wa/buttons.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';
const T=Date.parse('2026-10-18T02:00:00Z');
const A='11111@s.whatsapp.net',B='22222@s.whatsapp.net',C='33333@s.whatsapp.net';
function setup(){const db=openDatabase(':memory:'),core=createCore(db);let serial=0;const act=(user,text,now=T,eventKey='v131-'+(++serial))=>core.process({senderId:user,eventKey,text,now});return {db,core,act,done:()=>db.close()};}
function pending(x){x.act(A,'.chess join');const response=x.act(B,'.chess join');assert.match(response,/MATCH FOUND/);return response.match(/[A-F0-9]{10}/)[0];}
function active(x){const id=pending(x);x.act(A,'.chess accept');x.act(B,'.chess accept');return id;}
const all=x=>x.db.prepare('SELECT * FROM chess_notifications ORDER BY id').all();

test('v1.3.1 queue response includes waiting count, exit and lobby',()=>{const x=setup();try{const answer=x.act(A,'.chess join');assert.match(answer,/MENUNGGU LAWAN/);assert.match(answer,/1 pemain/);assert.match(answer,/\.chess leave/);assert.match(x.act(A,'.chess lobby'),/1 pemain/);assert.match(x.act(A,'.chess status'),/masih|Sedang mencari/i);assert.match(x.act(A,'.chess leave'),/Keluar antrean/);assert.match(x.act(A,'.chess lobby'),/0 pemain/);}finally{x.done();}});
test('v1.3.1 matching generates durable private notices for both participants',()=>{const x=setup();try{pending(x);const ns=all(x);assert.equal(ns.length,2);assert.ok(ns.every(n=>n.event_type==='match-found'));assert.deepEqual(new Set(ns.map(n=>n.recipient)),new Set([A,B]));assert.match(ns[0].body,/accept/);}finally{x.done();}});
test('v1.3.1 duplicate message ID does not create extra notifications',()=>{const x=setup();try{x.act(A,'.chess join');const r=x.act(B,'.chess join',T,'fixed-key');assert.match(x.act(B,'.chess join',T,'fixed-key'),/MATCH FOUND/);assert.equal(all(x).length,2);}finally{x.done();}});
test('v1.3.1 match acceptance sends status and opening board events',()=>{const x=setup();try{active(x);const ns=all(x);assert.equal(ns.filter(n=>n.event_type.startsWith('started-')).length,2);assert.equal(ns.filter(n=>n.show_board).length,2);assert.match(x.act(A,'.chess status'),/GILIRAN ANDA/);assert.match(x.act(B,'.chess status'),/Menunggu langkah lawan/);}finally{x.done();}});
test('v1.3.1 turn change enqueues board for correct opponent only',()=>{const x=setup();try{active(x);const before=all(x).length;assert.match(x.act(A,'.chess move e2e4'),/e2e4/);const notices=all(x).slice(before);assert.equal(notices.length,1);assert.equal(notices[0].recipient,B);assert.equal(notices[0].show_board,1);assert.match(notices[0].body,/GILIRAN ANDA/);}finally{x.done();}});
test('v1.3.1 resignation notifies winner, with no rating on short match',()=>{const x=setup();try{active(x);x.act(A,'.chess resign');const rows=all(x).filter(n=>n.event_type==='winner-resign');assert.equal(rows.length,1);assert.equal(rows[0].recipient,B);assert.match(rows[0].body,/ANDA MENANG/);assert.match(x.act(B,'.chess status'),/ANDA MENANG/);}finally{x.done();}});
test('v1.3.1 pending cancel notifies opponent and enables next queue',()=>{const x=setup();try{pending(x);assert.match(x.act(A,'.chess cancel'),/dibatalkan/);assert.equal(all(x).filter(n=>n.event_type==='cancel').length,1);assert.match(x.act(A,'.chess join'),/antre/);}finally{x.done();}});
test('v1.3.1 timeout queues an expiry notice once per player',()=>{const x=setup();try{active(x);x.core.claimChessNotifications({now:T+86400001});assert.equal(all(x).filter(n=>n.event_type==='expired').length,2);x.core.claimChessNotifications({now:T+86400002});assert.equal(all(x).filter(n=>n.event_type==='expired').length,2);}finally{x.done();}});
test('v1.3.1 notifier defers when offline, sends boards, acks delivered',async()=>{const x=setup();try{active(x);const out=[];let connected=false;const n=createChessNotifier({core:x.core,isConnected:()=>connected,sendText:async(j,t)=>out.push(['text',j,t]),sendImage:async(j,b,t)=>out.push(['image',j,t,b])});assert.equal((await n.flush(T)).sent,0);connected=true;const result=await n.flush(T);assert.equal(result.sent,5);assert.equal(out.filter(t=>t[0]==='image').length,2);assert.equal(x.db.prepare('SELECT COUNT(*) n FROM chess_notifications WHERE delivered_at IS NULL').get().n,0);}finally{x.done();}});
test('v1.3.1 notifier retains failed delivery for retry without ack',async()=>{const x=setup();try{pending(x);const n=createChessNotifier({core:x.core,sendText:async()=>{throw Error('offline');}});const result=await n.flush(T);assert.equal(result.failed,2);assert.equal(x.db.prepare('SELECT COUNT(*) n FROM chess_notifications WHERE delivered_at IS NULL').get().n,2);assert.equal(x.core.claimChessNotifications({now:T+1}).length,0);assert.equal(x.core.claimChessNotifications({now:T+30_001}).length,2);}finally{x.done();}});
test('v1.3.1 button navigation has max 3 buttons and maps all commands',()=>{for(const [key,panel] of Object.entries(PANELS)){assert.equal(panel.buttons.length,3,key);for(const b of panel.buttons)assert.equal(BUTTON_COMMANDS[b.id],b.command);}for(const key of ['chessqueue','chesspending','chessactive','arenanav','more','explore'])assert.ok(PANELS[key]);});
test('v1.3.1 WhatsApp chess panel follows queue/pending/active state',async()=>{const x=setup();try{let i=0;const calls=[];const handler=createWhatsAppHandler({core:x.core,sendText:async()=>{},sendButtons:async(j,mode,msg,opts)=>{calls.push(opts.panelName);return {sent:true};}});const h=async(j,text)=>handler({key:{remoteJid:j,id:'msg'+(++i),fromMe:false},message:{conversation:text}});await h(A,'.chess join');assert.equal(calls.at(-1),'chessqueue');await h(B,'.chess join');assert.equal(calls.at(-1),'chesspending');await h(A,'.chess accept');await h(B,'.chess accept');assert.equal(calls.at(-1),'chessactive');await h(A,'.nav arena');assert.equal(calls.at(-1),'arenanav');}finally{x.done();}});
test('v1.3.1 notifications persist on restart and remain private',async()=>{
  const {mkdtempSync,rmSync}=await import('node:fs');const {join}=await import('node:path');const {tmpdir}=await import('node:os');
  const folder=mkdtempSync(join(tmpdir(),'wa-chess-outbox-'));const file=join(folder,'store.sqlite');let db;
  try {
    db=openDatabase(file);let core=createCore(db);core.process({senderId:A,text:'.chess join',eventKey:'p1',now:T});core.process({senderId:B,text:'.chess join',eventKey:'p2',now:T});db.close();
    db=openDatabase(file);core=createCore(db);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM chess_notifications').get().n,2);
    assert.equal(core.getChessBoard({senderId:C}),null);
    const notices=core.claimChessNotifications({now:T});assert.deepEqual(new Set(notices.map(n=>n.recipient)),new Set([A,B]));
  }finally{db?.close();rmSync(folder,{recursive:true,force:true});}
});
