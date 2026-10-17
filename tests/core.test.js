import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db.js';
import { createCore } from '../src/core.js';

function setup(n=0){
  const db=openDatabase(':memory:');
  const core=createCore(db,{randomInt:(min,max)=>Math.max(min,Math.min(n,max-1))});
  const send=(text,eventKey,senderId='alice',now=Date.now())=>core.process({senderId,eventKey,text,now});
  return {db,core,send};
}
test('menu creates user and wallet at 0 without topup',()=>{
 const {db,send}=setup();
 assert.match(send('.menu','1'),/WA-WORLD/);
 assert.match(send('.wallet','2'),/0 V-Currency/);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n,1);
 db.close();
});
test('reward event idempotent and atomic wallet ledger',()=>{
 const {db,send}=setup(0);
 const first=send('.coin kepala','one');
 const dup=send('.coin kepala','one');
 assert.equal(first,dup);
 assert.match(first,/Menang/);
 assert.match(send('.wallet','wallet'),/3 V-Currency/);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n,1);
 db.close();
});
test('guess state persists and rewards for exact match',()=>{
 const {db,send}=setup(7);
 assert.match(send('.guess start','g0'),/3 percobaan/);
 assert.match(send('.guess 7','g1'),/Benar/);
 assert.match(send('.wallet','g2'),/15 V-Currency/);
 assert.match(send('.guess 7','g3'),/Tidak ada sesi/);
 db.close();
});
test('invalid commands cannot alter balance',()=>{
 const {db,send}=setup();
 assert.match(send('.coin nggak','bad1'),/Gunakan/);
 assert.match(send('.rps random','bad2'),/Gunakan/);
 assert.equal(db.prepare('SELECT COALESCE(SUM(balance),0) AS n FROM wallets').get().n,0);
 db.close();
});
test('per user game sessions are isolated',()=>{
 const {db,send}=setup(5);
 send('.guess start','a','alice');
 assert.match(send('.guess 5','b','bob'),/Tidak ada sesi/);
 assert.match(send('.guess 5','c','alice'),/Benar/);
 db.close();
});
test('same event cannot credit another player',()=>{
 const {db,send}=setup(0);
 send('.coin kepala','event','alice');
 send('.coin kepala','event','bob');
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n,1);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM wallets WHERE balance>0').get().n,1);
 db.close();
});
