import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db.js';
import {createCore,GAMES} from '../src/core.js';
const now=Date.parse('2026-10-17T12:00:00Z');
function setup(draw=(min)=>min){
 const db=openDatabase(':memory:'),core=createCore(db,{randomInt:draw});let event=0;
 const send=(text,id='qa',time=now)=>core.process({senderId:id,eventKey:`test:${id}:${++event}`,text,now:time});
 return {db,core,send};
}
test('Game Pack 01 remains included in the 24-game catalog',()=>{
 assert.ok(GAMES.length>=24);assert.equal(new Set(GAMES.map(x=>x.id)).size,GAMES.length);
});
test('Game Pack single-turn dice, parity and highlow are counted, capped and rewarded safely',()=>{
 const {db,send}=setup();
 assert.match(send('.dice 1'),/Menang/);
 assert.match(send('.parity ganjil'),/Menang/);
 assert.match(send('.highlow naik'),/Belum berhasil/);
 assert.equal(db.prepare('SELECT balance FROM wallets').get().balance,9);
 assert.equal(db.prepare('SELECT plays FROM player_stats').get().plays,3);
 db.close();
});
test('Game Pack math challenge persists across commands, awards once, and clears on victory',()=>{
 const {db,send}=setup();
 assert.match(send('.math start'),/2 × 2/);
 assert.match(send('.math 4'),/Menang/);
 assert.match(send('.math 4'),/tidak ada/);
 assert.equal(db.prepare('SELECT balance FROM wallets').get().balance,8);
 db.close();
});
test('Game Pack quiz, scramble, pattern, memory, cipher, emoji and riddle each work with their own state',()=>{
 const {db,send}=setup();
 const trials=[['trivia','a'],['scramble','karet'],['pattern','9'],['memory','1000'],['cipher','kode'],['emoji','hujan'],['riddle','jam']];
 for(const [game,answer] of trials){assert.match(send(`.${game} start`),/dimulai/);assert.match(send(`.${game} ${answer}`),/Menang/,game);}
 assert.equal(db.prepare('SELECT plays FROM player_stats').get().plays,7);
 assert.equal(db.prepare('SELECT balance FROM wallets').get().balance,58);
 db.close();
});
test('Game Pack hangman tracks guessed letters independently and word chain requires valid transitions',()=>{
 const {db,send}=setup();
 assert.match(send('.hangman start'),/Tebak satu huruf/);
 assert.match(send('.hangman k'),/Sisa/);
 assert.match(send('.hangman k'),/sudah dicoba/);
 for(const c of 'omputer')send('.hangman '+c);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM challenge_sessions WHERE game=?').get('hangman').n,0);
 assert.match(send('.chain start'),/Sambung kata/);
 assert.match(send('.chain ular'),/1\/3/);
 assert.match(send('.chain rumah'),/2\/3/);
 assert.match(send('.chain harimau'),/Menang/);
 assert.equal(db.prepare('SELECT plays FROM player_stats').get().plays,2);
 db.close();
});
test('Game Pack challenge expiry is enforced, isolated per player; invalid answer is not rewarded',()=>{
 const {db,send}=setup();
 send('.trivia start','A',now);
 assert.match(send('.trivia a','B',now),/tidak ada/);
 assert.match(send('.trivia a','A',now+16*60_000),/kadaluarsa/);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n,0);
 assert.match(send('.dice 8'),/1–6/);
 db.close();
});
test('daily mission progress, claim once, no replay credits; badges are private',()=>{
 const {db,send}=setup();
 assert.match(send('.missions'),/Mainkan 3 ronde/);
 send('.coin kepala');send('.dice 1');send('.parity ganjil');
 assert.match(send('.mission claim play3'),/\+8/);
 assert.match(send('.mission claim play3'),/sudah diklaim/);
 assert.match(send('.mission claim win2'),/\+12/);
 assert.match(send('.mission claim win2'),/sudah diklaim/);
 assert.match(send('.mission claim daily'),/belum selesai/);
 send('.daily');
 assert.match(send('.mission claim daily'),/\+5/);
 assert.match(send('.badges'),/Pemain Pertama/);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM daily_mission_claims').get().n,3);
 assert.equal(db.prepare('SELECT balance FROM wallets').get().balance,47);
 db.close();
});
test('mission progress resets by WIB calendar, claimed reward remains one per day',()=>{
 const {db,send}=setup();
 const before=Date.parse('2026-10-16T16:58:00Z'),after=Date.parse('2026-10-16T17:02:00Z');
 send('.coin kepala','A',before);
 assert.match(send('.missions','A',after),/Mainkan 3 ronde \(0\/3\)/);
 db.close();
});
test('duplicate message id does not replay mission progress or game rewards',()=>{
 const {db,core}=setup();
 const message={senderId:'A',eventKey:'dup:message',text:'.dice 1',now};
 assert.equal(core.process(message),core.process(message));
 assert.equal(db.prepare('SELECT plays FROM daily_mission_progress').get().plays,1);
 assert.equal(db.prepare('SELECT count(*) AS n FROM ledger').get().n,1);
 db.close();
});
import {PANELS,BUTTON_COMMANDS} from '../src/wa/buttons.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';

test('Game Pack native button IDs map to allowable commands',()=>{
 for(const pack of ['packs','lucky','brain','word']){
  assert.equal(PANELS[pack].buttons.length,3);
  for(const b of PANELS[pack].buttons)assert.equal(BUTTON_COMMANDS[b.id],b.command);
 }
});
test('Game Pack native button starts math challenge via WhatsApp handler and persists it',async()=>{
 const {db,core}=setup();const sent=[];const panel=[];
 const handle=createWhatsAppHandler({core,sendText:async(_jid,msg)=>sent.push(msg),sendButtons:async(_jid,mode,_quoted,opts)=>{panel.push(opts?.panelName);return {sent:true,stage:'relayed-unverified'};}});
 const make=(id,key)=>({key:{remoteJid:'Alice@s.whatsapp.net',id:key,fromMe:false},message:{interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:JSON.stringify({id})}}}});
 await handle(make('waw:pack:brain','a'));
 assert.equal(panel.at(-1),'brain');
 await handle(make('waw:math','b'));
 assert.match(sent.at(-1),/MATH dimulai/);
 assert.equal(db.prepare('SELECT count(*) AS n FROM challenge_sessions').get().n,1);
 db.close();
});
