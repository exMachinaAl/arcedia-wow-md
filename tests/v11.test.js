import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inflateSync} from 'node:zlib';
import {openDatabase} from '../src/db.js';
import {createCore,GAMES} from '../src/core.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';
import {PANELS,BUTTON_COMMANDS} from '../src/wa/buttons.js';
const T=Date.parse('2026-10-18T02:00:00Z');
function setup(draw=()=>6){
 const db=openDatabase(':memory:'),core=createCore(db,{randomInt:draw});let i=0;
 const act=(u,text,now=T,eventKey=`m-${++i}`)=>core.process({senderId:u,text,now,eventKey});
 return {db,core,act,close:()=>db.close()};
}
function start(x){
 assert.match(x.act('alice','.queue join snakes'),/masuk antrean/);
 const second=x.act('bob','.queue join snakes');const id=second.match(/[0-9A-F]{10}/)?.[0];assert.ok(id,second);
 return id;
}
test('Matchmaking v1.1: two consenting users get one persistent invitation',()=>{
 const x=setup();try{const id=start(x);assert.equal(x.db.prepare('SELECT COUNT(*) n FROM world_matches').get().n,1);assert.match(x.act('alice','.match current'),new RegExp(id));assert.match(x.act('bob','.match current'),new RegExp(id));assert.equal(x.db.prepare('SELECT count(*) n FROM match_queue').get().n,0);}finally{x.close();}
});
test('Matchmaking v1.1: ready handshake gates turn-based game',()=>{
 const x=setup();try{const id=start(x);assert.match(x.act('alice','.match roll'),/Belum bisa/);assert.match(x.act('alice','.match accept'),/Menunggu lawan/);assert.match(x.act('bob','.match accept'),/DIMULAI/);assert.equal(x.db.prepare('SELECT status FROM world_matches WHERE id=?').get(id).status,'ACTIVE');}finally{x.close();}
});
test('Turn engine v1.1: strict turn order and persisted position',()=>{
 const x=setup();try{const id=start(x);x.act('alice','.match accept');x.act('bob','.match accept');assert.match(x.act('bob','.match roll'),/Belum giliranmu/);assert.match(x.act('alice','.match roll'),/6/);assert.equal(JSON.parse(x.db.prepare('SELECT state FROM world_matches WHERE id=?').get(id).state).positions[0],6);assert.match(x.act('bob','.match roll'),/6/);assert.equal(x.db.prepare('SELECT COUNT(*) n FROM world_match_events WHERE match_id=?').get(id).n,2);}finally{x.close();}
});
test('Turn engine v1.1: snakes/ladders jump and never gamble',()=>{
 const x=setup(()=>3);try{const id=start(x);x.act('alice','.match accept');x.act('bob','.match accept');assert.match(x.act('alice','.match roll'),/tangga/);const state=JSON.parse(x.db.prepare('SELECT state FROM world_matches WHERE id=?').get(id).state);assert.equal(state.positions[0],22);assert.equal(x.db.prepare('SELECT COALESCE(sum(balance),0) n FROM wallets').get().n,0);}finally{x.close();}
});
test('Matchmaking v1.1: idempotent replay does not roll twice',()=>{
 const x=setup();try{start(x);x.act('alice','.match accept');x.act('bob','.match accept');const first=x.act('alice','.match roll',T,'same');const copy=x.act('alice','.match roll',T,'same');assert.equal(first,copy);assert.equal(x.db.prepare('SELECT COUNT(*) n FROM world_match_events').get().n,1);}finally{x.close();}
});
test('Matchmaking v1.1: outsiders cannot see state or roll',()=>{
 const x=setup();try{const id=start(x);assert.match(x.act('charlie',`.match status ${id}`),/tidak ditemukan/);assert.match(x.act('charlie',`.match roll ${id}`),/tidak ditemukan/);assert.equal(x.core.getMatchBoard({senderId:'charlie',matchId:id}),null);}finally{x.close();}
});
test('Matchmaking v1.1: leave queue and pending expiration',()=>{
 const x=setup();try{x.act('alice','.queue join snakes');x.act('alice','.queue leave');assert.match(x.act('alice','.queue status'),/belum antre/);start(x);const msg=x.act('alice','.match current',T+301000);assert.match(msg,/EXPIRED/);}finally{x.close();}
});
test('Matchmaking v1.1: preserves game state on database restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'waw-mp-')),file=join(dir,'world.sqlite');
 try {let db=openDatabase(file),core=createCore(db),i=0;const run=(u,s)=>core.process({senderId:u,text:s,eventKey:`persist-${++i}`,now:T});run('alice','.queue join snakes');const answer=run('bob','.queue join snakes');const id=answer.match(/[0-9A-F]{10}/)[0];run('alice','.match accept');run('bob','.match accept');db.close();db=openDatabase(file);core=createCore(db);assert.match(core.process({senderId:'alice',text:'.match current',eventKey:'reopen',now:T}),new RegExp(id));db.close();} finally {rmSync(dir,{force:true,recursive:true});}
});
test('Matchmaking v1.1: resign ends match, duplicate accept harmless',()=>{
 const x=setup();try{start(x);x.act('alice','.match accept');x.act('alice','.match accept');assert.equal(JSON.parse(x.db.prepare('SELECT accepts FROM world_matches').get().accepts).length,1);x.act('bob','.match resign');assert.equal(x.db.prepare('SELECT status FROM world_matches').get().status,'CANCELLED');}finally{x.close();}
});
test('PNG Board v1.1: produces real 600x600 PNG and validates image integrity',()=>{
 const x=setup();try{const id=start(x);const board=x.core.getMatchBoard({senderId:'alice',matchId:id});assert.deepEqual([...board.png.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(board.png.readUInt32BE(16),600);assert.equal(board.png.readUInt32BE(20),600);assert.ok(board.png.includes(Buffer.from('IDAT')));assert.ok(board.png.length>1000);}finally{x.close();}
});
test('PNG Board v1.1: game catalog and button permissions',()=>{
 assert.ok(GAMES.some(g=>g.id==='snakes'));for(const panel of ['arena','match'])for(const b of PANELS[panel].buttons)assert.equal(BUTTON_COMMANDS[b.id],b.command);
});
test('Image handler v1.1: sends PNG in private WhatsApp mock',async()=>{
 const x=setup();const logs=[];const handler=createWhatsAppHandler({core:x.core,sendButtons:async()=>({sent:true}),sendText:async(j,t)=>logs.push(['text',j,t]),sendImage:async(j,b,caption)=>logs.push(['image',j,b,caption])});
 try{x.act('alice@s.whatsapp.net','.queue join snakes');const response=x.act('bob@s.whatsapp.net','.queue join snakes');const id=response.match(/[0-9A-F]{10}/)[0];const msg={key:{remoteJid:'alice@s.whatsapp.net',fromMe:false,id:'board-1'},message:{conversation:`.match board ${id}`}};const out=await handler(msg);assert.equal(out.action,'match-board-image');assert.equal(logs[0][0],'image');assert.equal(logs[0][2].readUInt32BE(16),600);}finally{x.close();}
});
test('Image handler v1.1: ignores multiplayer commands in groups',async()=>{
 const x=setup();const logs=[];const handler=createWhatsAppHandler({core:x.core,allowGroups:true,sendButtons:async()=>({sent:true}),sendText:async(j,t)=>logs.push(t)});
 try{const m={key:{remoteJid:'private-group@g.us',participant:'alice@s.whatsapp.net',id:'groupjoin'},message:{conversation:'.queue join snakes'}};const out=await handler(m);assert.equal(out.ignored,'social-private-only');assert.equal(x.db.prepare('SELECT COUNT(*) n FROM match_queue').get().n,0);assert.match(logs[0],/chat pribadi/);}finally{x.close();}
});
test('Matchmaking v1.1: refuses unauthorised explicit match IDs',()=>{
 const x=setup();try{const id=start(x);assert.match(x.act('charlie',`.match board ${id}`),/tidak ditemukan/);assert.match(x.act('alice',`.match status NOTVALID`),/tidak ditemukan/);}finally{x.close();}
});
test('Turn engine v1.1: next match wait allowed after resignation',()=>{
 const x=setup();try{const id=start(x);x.act('alice','.match resign');assert.match(x.act('alice','.queue join snakes'),/masuk antrean/);assert.equal(x.db.prepare('SELECT status FROM world_matches WHERE id=?').get(id).status,'CANCELLED');}finally{x.close();}
});
