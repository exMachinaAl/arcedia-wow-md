import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db.js';
import {createCore,GAMES} from '../src/core.js';
import {EXPLORER_GAMES} from '../src/games/explorer-pack.js';
import {PANELS,BUTTON_COMMANDS} from '../src/wa/buttons.js';
const T=Date.parse('2026-10-17T12:00:00Z');
function fixture(){const db=openDatabase(':memory:');const core=createCore(db,{randomInt:min=>min});let seq=0;
const run=(user,text,at=T,key=`pack04-${++seq}`)=>core.process({senderId:user,text,eventKey:key,now:at});return {db,run};}
test('Pack 04 has twelve new game mechanics, 48 game registry ids unique',()=>{
 assert.equal(EXPLORER_GAMES.length,12);assert.ok(GAMES.length>=48);assert.equal(new Set(GAMES.map(x=>x.id)).size,GAMES.length);
});
for(const game of EXPLORER_GAMES){test(`Pack 04 ${game.id}: persisted question, reward, replay, expiry`,()=>{
 const {db,run}=fixture();const question=run('a',`.${game.id} start`);assert.match(question,/Jawab:/);
 const row=db.prepare('SELECT payload FROM challenge_sessions WHERE user_id=? AND game=?').get('a',game.id);
 assert.ok(row);const answer=JSON.parse(row.payload).solution;
 const won=run('a',`.${game.id} ${answer}`,T,'same-event');assert.match(won,/Jawaban benar/);
 assert.equal(db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('a').balance,7);
 assert.equal(run('a',`.${game.id} ${answer}`,T,'same-event'),won);
 assert.equal(db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('a').balance,7);
 run('a',`.${game.id} start`);
 assert.match(run('a',`.${game.id} ${answer}`,T+16*60_000),/kedaluwarsa/);
 db.close();
});}
test('Pack 04 session isolation and shared reward cap',()=>{
 const {db,run}=fixture();run('alice','.median start');run('bob','.median start');
 assert.equal(db.prepare("SELECT COUNT(*) n FROM challenge_sessions WHERE game='median'").get().n,2);
 const answer=JSON.parse(db.prepare("SELECT payload FROM challenge_sessions WHERE user_id='alice' AND game='median'").get().payload).solution;
 run('alice',`.median ${answer}`);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM challenge_sessions WHERE user_id='bob' AND game='median'").get().n,1);
 db.prepare('INSERT INTO daily_game_earnings(user_id,day,earned) VALUES(?,?,?)').run('bob','2026-10-17',99);
 const bobanswer=JSON.parse(db.prepare("SELECT payload FROM challenge_sessions WHERE user_id='bob' AND game='median'").get().payload).solution;
 assert.match(run('bob',`.median ${bobanswer}`),/\+1 V/);
 db.close();
});
test('Pack 04 buttons use explicit allowlist, fallback text and full game catalog',()=>{
 const {db,run}=fixture();
 for(const p of ['packs4','exploration','data4']){
  assert.ok(PANELS[p]);for(const b of PANELS[p].buttons)assert.equal(BUTTON_COMMANDS[b.id],b.command);
 }
 assert.match(run('a','.packs4'),/Pack 04/);
 assert.match(run('a','.pack exploration'),/primefactors/);
 assert.match(run('a','.pack data4'),/caesar/);
 assert.match(run('a','.games'),/\d+\/100/);
 assert.match(run('a','.games all'),/setunion/);
 assert.match(run('a','.world'),/\d+\/100/);
 db.close();
});
