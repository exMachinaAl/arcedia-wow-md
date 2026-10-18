import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db.js';
import {createCore,GAMES} from '../src/core.js';
import {ADVENTURE_GAMES} from '../src/games/adventure-pack.js';
import {PANELS,BUTTON_COMMANDS} from '../src/wa/buttons.js';
const T=Date.parse('2026-10-17T12:00:00Z');
function fixture(){const db=openDatabase(':memory:'); const core=createCore(db,{randomInt:min=>min});let seq=0;
  const run=(user,text,when=T,key=`v08:${++seq}`)=>core.process({senderId:user,text,eventKey:key,now:when});
  return {db,core,run};}
test('Game Pack 03 registers twelve distinct playable games, total thirty-six',()=>{
  assert.equal(ADVENTURE_GAMES.length,12);assert.ok(GAMES.length>=36);
  assert.equal(new Set(GAMES.map(g=>g.id)).size,GAMES.length);
});
for(const game of ADVENTURE_GAMES){
 test(`Game Pack 03 ${game.id}: round reward, replay protection and expiry`,()=>{
   const {db,run}=fixture();
   const prompt=run('player',`.${game.id} start`);assert.match(prompt, /Jawab:/);
   const state=db.prepare('SELECT payload FROM challenge_sessions WHERE user_id=? AND game=?').get('player',game.id);
   assert.ok(state);const answer=JSON.parse(state.payload).solution;
   const first=run('player',`.${game.id} ${answer}`,T,'same-message');
   assert.match(first,/Jawaban benar/);
   const balance=db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('player').balance;
   assert.equal(balance,7);
   assert.equal(run('player',`.${game.id} ${answer}`,T,'same-message'),first);
   assert.equal(db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('player').balance,7);
   assert.match(run('player',`.${game.id} start`),/Jawab:/);
   assert.match(run('player',`.${game.id} ${answer}`,T+16*60_000),/kedaluwarsa/);
   db.close();
 });
}
test('Game Pack 03 sessions belong to each player, no cross-account access',()=>{
 const {db,run}=fixture();run('a','.morse start');run('b','.morse start');
 assert.equal(db.prepare("SELECT count(*) AS n FROM challenge_sessions WHERE game='morse'").get().n,2);
 const a=JSON.parse(db.prepare("SELECT payload FROM challenge_sessions WHERE user_id='a' AND game='morse'").get().payload).solution;
 assert.match(run('a',`.morse ${a}`),/Jawaban benar/);
 assert.equal(db.prepare("SELECT count(*) AS n FROM challenge_sessions WHERE user_id='b'").get().n,1);db.close();
});
test('Pack 03 WhatsApp native buttons have explicit allowlisted command IDs',()=>{
 assert.ok(PANELS.packs3);assert.ok(PANELS.puzzle3);assert.ok(PANELS.word3);
 for(const p of ['packs3','puzzle3','word3'])for(const b of PANELS[p].buttons)assert.equal(BUTTON_COMMANDS[b.id],b.command);
});
test('World summary and third pack navigation describe current version',()=>{
 const {db,run}=fixture();assert.match(run('a','.world'),/\d+\/100/);assert.match(run('a','.packs3'),/Pack 03/);
 assert.match(run('a','.pack puzzles'),/factorial/); assert.match(run('a','.pack words3'),/morse/);db.close();
});
test('Pack 03 daily reward cap shared across old and new games',()=>{
 const {db,run}=fixture();
 db.prepare('INSERT INTO users(id) VALUES(?)').run('a');db.prepare('INSERT INTO wallets(user_id) VALUES(?)').run('a');db.prepare('INSERT INTO player_stats(user_id) VALUES(?)').run('a');
 db.prepare('INSERT INTO daily_game_earnings(user_id,day,earned) VALUES(?,?,?)').run('a','2026-10-17',99);
 run('a','.factorial start');const answer=JSON.parse(db.prepare("SELECT payload FROM challenge_sessions WHERE user_id='a' AND game='factorial'").get().payload).solution;
 assert.match(run('a',`.factorial ${answer}`),/\+1 V/);
 assert.equal(db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('a').balance,1);
 db.close();
});
