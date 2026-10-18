import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,inTransaction} from '../src/db.js';
import {createCore} from '../src/core.js';
import {createPvpEconomy} from '../src/pvp-economy.js';
const NOW=Date.parse('2026-10-18T11:00:00+07:00');
function env(draw=()=>1){
 const dir=mkdtempSync(join(tmpdir(),'wow-pvp-')),file=join(dir,'game.sqlite');
 let db=openDatabase(file),core=createCore(db,{randomInt:draw});let n=0;
 const send=(u,c,at=NOW,k)=>core.process({senderId:u,text:c,now:at,eventKey:k??`pvp:${++n}`});
 const read=(sql,...args)=>db.prepare(sql).get(...args);
 const close=()=>{db.close();rmSync(dir,{recursive:true,force:true});};
 const reopen=()=>{db.close();db=openDatabase(file);core=createCore(db,{randomInt:draw});};
 return {send,read,close,reopen,get db(){return db;},get core(){return core;}};
}
function scenario(name,fn){test(name,()=>{const e=env();try{fn(e);}finally{e.close()}})}
scenario('v1.8 mode preferences default safely and account isolation',e=>{
 assert.match(e.send('a','.pvp'),/Catur: RANKED/);
 assert.match(e.send('a','.pvp mode chess casual'),/CASUAL/);
 assert.match(e.send('a','.pvp'),/Catur: CASUAL/);
 assert.match(e.send('b','.pvp'),/Catur: RANKED/);
 assert.match(e.send('a','.pvp mode blackjack ranked'),/statistik saja/);
 assert.match(e.send('a','.pvp mode fake ranked'),/invalid/);
});
scenario('v1.8 different chess modes never get automatically matched',e=>{
 e.send('a','.chess join casual'); e.send('b','.chess join ranked');
 assert.equal(e.read('SELECT COUNT(*) n FROM chess_matches').n,0);
 e.send('c','.chess join casual');
 assert.equal(e.read('SELECT COUNT(*) n FROM chess_matches').n,1);
 const id=e.read('SELECT id FROM chess_matches').id;
 assert.equal(e.read('SELECT mode FROM pvp_match_modes WHERE match_id=?',id).mode,'casual');
 assert.match(e.send('a','.chess status'),/CASUAL/);
 assert.match(e.send('a','.pvp mode chess ranked'),/Selesaikan match/);
});
scenario('v1.8 different snakes modes never get automatically matched',e=>{
 e.send('a','.queue join snakes casual');e.send('b','.queue join snakes ranked');
 assert.equal(e.read('SELECT COUNT(*) n FROM world_matches').n,0);
 e.send('c','.queue join snakes ranked');
 assert.equal(e.read('SELECT COUNT(*) n FROM world_matches').n,1);
 assert.equal(e.read("SELECT mode FROM pvp_match_modes WHERE game='snakes'").mode,'ranked');
});
scenario('v1.8 casual chess resignation never changes rating or V',e=>{
 e.send('a','.chess join casual');e.send('b','.chess join casual');
 e.send('a','.chess accept');e.send('b','.chess accept');
 const m=e.read('SELECT id FROM chess_matches');
 e.db.prepare('UPDATE chess_matches SET ply=12 WHERE id=?').run(m.id);
 const res=e.send('a','.chess resign');assert.match(res,/Rating tidak berubah/);
 assert.equal(e.read("SELECT COUNT(*) n FROM pvp_reward_claims").n,0);
 assert.equal(e.read("SELECT rating FROM chess_ratings WHERE user_id='a'").rating,1200);
 assert.equal(e.read('SELECT COUNT(*) n FROM pvp_settlements').n,2);
});
scenario('v1.8 ranked chess resignation cannot mint V even with sufficient moves',e=>{
 e.send('a','.chess join ranked');e.send('b','.chess join ranked');e.send('a','.chess accept');e.send('b','.chess accept');
 const match=e.read('SELECT id FROM chess_matches');e.db.prepare('UPDATE chess_matches SET ply=12 WHERE id=?').run(match.id);
 e.send('a','.chess resign');
 assert.equal(e.read('SELECT COUNT(*) n FROM pvp_reward_claims').n,0);
 assert.match(e.send('b','.pvp history'),/WIN • \+0 V/);
});
scenario('v1.8 ranked victories are atomic, capped daily and exactly-once',e=>{
 e.send('a','.ping');e.send('b','.ping');
 const p=createPvpEconomy({db:e.db});
 const one=(id)=>inTransaction(e.db,()=>{p.register('chess',id,'ranked',NOW);return p.settle({game:'chess',id,players:['a','b'],winner:'a',completed:true,eligible:true,now:NOW})});
 assert.equal(one('C001').a,12);
 assert.equal(one('C001').a,12); // replay reports original result but creates no second credit
 assert.equal(e.read("SELECT balance FROM wallets WHERE user_id='a'").balance,12);
 assert.equal(one('C002').a,12);
 assert.equal(one('C003').a,0); // daily cap and same-opponent cap
 assert.equal(e.read("SELECT balance FROM wallets WHERE user_id='a'").balance,24);
 assert.equal(e.read('SELECT COUNT(*) n FROM pvp_reward_claims').n,2);
 assert.equal(e.read('SELECT COUNT(*) n FROM ledger WHERE reason=?','pvp-chess-ranked').n,2);
});
scenario('v1.8 daily reset still enforces pair cap per new WIB day',e=>{
 e.send('a','.ping');e.send('b','.ping');const p=createPvpEconomy({db:e.db});
 for(let i=0;i<3;i++){const at=NOW+(i<2?0:86400000);inTransaction(e.db,()=>{p.register('snakes','SN'+i,'ranked',at);p.settle({game:'snakes',id:'SN'+i,players:['a','b'],winner:'a',completed:true,eligible:true,now:at});});}
 assert.equal(e.read("SELECT balance FROM wallets WHERE user_id='a'").balance,24);
});
scenario('v1.8 settlement cannot pay for cancelled, draw, or casual match',e=>{
 e.send('a','.ping');e.send('b','.ping');const p=createPvpEconomy({db:e.db});
 for(const [id,mode,completed,winner,eligible] of [['A','ranked',false,'a',true],['B','ranked',true,null,true],['C','casual',true,'a',true],['D','ranked',true,'a',false]]){
  inTransaction(e.db,()=>{p.register('chess',id,mode,NOW);p.settle({game:'chess',id,players:['a','b'],winner,completed,eligible,now:NOW});});
 }
 assert.equal(e.read("SELECT balance FROM wallets WHERE user_id='a'").balance,0);
 assert.equal(e.read('SELECT COUNT(*) n FROM pvp_settlements').n,8);
});
scenario('v1.8 persistence and modes survive database reopen',e=>{
 e.send('a','.pvp mode snakes ranked');e.reopen();assert.match(e.send('a','.pvp'),/Ular Tangga: RANKED/);
 e.send('a','.ping');e.send('b','.ping');const p=createPvpEconomy({db:e.db});
 inTransaction(e.db,()=>{p.register('snakes','persist','ranked',NOW);p.settle({game:'snakes',id:'persist',players:['a','b'],winner:'a',completed:true,eligible:true,now:NOW});});
 e.reopen();assert.equal(e.read("SELECT balance FROM wallets WHERE user_id='a'").balance,8);
 assert.match(e.send('a','.pvp history'),/\+8 V/);
});
scenario('v1.8 replay of mode command does not mutate balances or duplicate messages',e=>{
 const r=e.send('a','.pvp mode chess casual',NOW,'key1');
 assert.equal(e.send('a','.pvp mode chess casual',NOW,'key1'),r);
 assert.equal(e.read('SELECT COUNT(*) n FROM processed_messages').n,1);
});
scenario('v1.8 Blackjack mode metadata and no outcome-based V reward',e=>{
 e.send('a','.pvp mode blackjack ranked');
 const response=e.send('a','.bj create');assert.match(response,/Meja privat/);
 const id=e.read('SELECT id FROM bj_rooms').id;
 assert.equal(e.read('SELECT mode FROM pvp_match_modes WHERE game=? AND match_id=?','blackjack',id).mode,'ranked');
 assert.match(e.send('a','.bj status'),/RANKED/);
 assert.equal(e.read('SELECT COUNT(*) n FROM pvp_reward_claims').n,0);
});
scenario('v1.8 actual ranked chess checkmate awards only the winner in V',e=>{
 e.send('a','.chess join ranked');e.send('b','.chess join ranked');
 e.send('a','.chess accept');e.send('b','.chess accept');
 const m=e.read('SELECT white_id,black_id,id FROM chess_matches');
 const sequence=['a2a3','a7a6','b2b3','b7b6','f2f3','e7e5','g2g4','d8h4'];
 let output='';
 sequence.forEach((cmd,i)=>output=e.send(i%2===0?m.white_id:m.black_id,'.chess move '+cmd));
 assert.match(output,/CHECKMATE/);
 assert.equal(e.read('SELECT status FROM chess_matches WHERE id=?',m.id).status,'DONE');
 assert.equal(e.read('SELECT balance FROM wallets WHERE user_id=?',m.black_id).balance,12);
 assert.equal(e.read('SELECT balance FROM wallets WHERE user_id=?',m.white_id).balance,0);
 assert.match(e.send(m.black_id,'.pvp history'),/WIN • \+12 V/);
});
scenario('v1.8 actual snakes ranked final square awards V once',e=>{
 e.send('a','.queue join snakes ranked');e.send('b','.queue join snakes ranked');
 const m=e.read('SELECT * FROM world_matches');
 e.send('a','.match accept');e.send('b','.match accept');
 const state=JSON.parse(e.read('SELECT state FROM world_matches WHERE id=?',m.id).state);
 state.positions=[99,13];state.turn=0;
 e.db.prepare('UPDATE world_matches SET state=? WHERE id=?').run(JSON.stringify(state),m.id);
 assert.match(e.send(m.player_a,'.match roll'),/PEMENANG P1/);
 assert.equal(e.read('SELECT balance FROM wallets WHERE user_id=?',m.player_a).balance,8);
 assert.equal(e.read('SELECT balance FROM wallets WHERE user_id=?',m.player_b).balance,0);
 assert.equal(e.read('SELECT COUNT(*) n FROM pvp_reward_claims').n,1);
});
