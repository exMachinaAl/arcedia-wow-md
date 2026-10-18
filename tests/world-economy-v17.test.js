import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {PANELS,BUTTON_COMMANDS} from '../src/wa/buttons.js';
const START=Date.parse('2026-10-18T07:00:00+07:00');
function env(opts={}){
 const dir=mkdtempSync(join(tmpdir(),'wow-v17-'));const path=join(dir,'state.sqlite');
 let db=openDatabase(path),core=createCore(db,opts),seq=0;
 const send=(user,cmd,when=START,key)=>core.process({senderId:user,text:cmd,eventKey:key??`test:${++seq}`,now:when});
 const sql=(q,...params)=>db.prepare(q).get(...params);
 const reopen=()=>{db.close();db=openDatabase(path);core=createCore(db,opts);};
 const done=()=>{db.close();rmSync(dir,{recursive:true,force:true});};
 return {send,sql,reopen,done,get db(){return db;},get core(){return core;}};
}
function caseTest(name,fn){test(name,()=>{const e=env();try{fn(e);}finally{e.done()}})}
caseTest('WOW starter can be claimed only once; old wallets still intact',e=>{
 assert.match(e.send('a','.wow'),/WORLD OF WA/);
 assert.match(e.send('a','.wow starter'),/\+75 V/);
 assert.match(e.send('a','.wow starter'),/sudah diklaim/);
 assert.equal(e.sql('SELECT balance FROM wallets WHERE user_id=?','a').balance,75);
 assert.equal(e.sql('SELECT COUNT(*) AS n FROM ledger WHERE reason=?','wow-starter').n,1);
});
caseTest('starter message replay does not double reward',e=>{
 const first=e.send('a','.wow starter',START,'msg1');
 assert.equal(e.send('a','.wow starter',START,'msg1'),first);
 assert.equal(e.sql('SELECT balance FROM wallets WHERE user_id=?','a').balance,75);
});
caseTest('mining grants guaranteed capped income each WIB day',e=>{
 for(let i=0;i<3;i++)assert.match(e.send('a','.mine'),/Tambang/);
 assert.match(e.send('a','.mine'),/habis/);
 assert.equal(e.sql('SELECT balance FROM wallets WHERE user_id=?','a').balance,24);
 assert.equal(e.sql('SELECT COUNT(*) AS n FROM world_mining').n,3);
 assert.match(e.send('a','.mine',START+86400000),/Tambang/);
 assert.equal(e.sql('SELECT balance FROM wallets WHERE user_id=?','a').balance,30);
});
caseTest('virtual job has single daily payout and no buy-in',e=>{
 assert.match(e.send('a','.work complete'),/\+12 V/);
 assert.match(e.send('a','.work complete'),/sudah selesai/);
 assert.match(e.send('a','.work complete',START+86400000),/\+12 V/);
 assert.equal(e.sql('SELECT balance FROM wallets WHERE user_id=?','a').balance,24);
});
caseTest('synthetic quotes remain constant within day',e=>{
 const a=e.send('a','.market'),b=e.send('a','.market',START+3600000);
 assert.equal(a,b);assert.match(a,/BURSA FIKTIF/);assert.match(e.send('a','.market outlook'),/BUKAN ML TERLATIH/);
});
caseTest('buy/sell fictional holdings debit/credit atomically',e=>{
 e.send('a','.wow starter');
 const initial=e.sql('SELECT balance FROM wallets WHERE user_id=?','a').balance;
 const buy=e.send('a','.market buy AQUA 1');assert.match(buy,/MEMBELI 1 AQUA/);
 const price=e.sql("SELECT unit_price FROM world_market_trades WHERE side='BUY'").unit_price;
 assert.equal(e.sql('SELECT balance FROM wallets WHERE user_id=?','a').balance,initial-price);
 assert.match(e.send('a','.market portfolio'),/AQUA: 1/);
 assert.match(e.send('a','.market sell AQUA 1'),/MENJUAL 1 AQUA/);
 assert.equal(e.sql('SELECT balance FROM wallets WHERE user_id=?','a').balance,initial);
 assert.equal(e.sql('SELECT shares FROM world_market_holdings WHERE user_id=? AND symbol=?','a','AQUA').shares,0);
 assert.equal(e.sql('SELECT COUNT(*) AS n FROM world_wallet_movements').n,2);
});
caseTest('market overspend, invalid symbol and oversell are safe',e=>{
 assert.match(e.send('a','.market buy NOVA 2'),/Saldo tidak cukup/);
 assert.match(e.send('a','.market buy FAKE 2'),/Gunakan/);
 assert.match(e.send('a','.market sell NOVA 1'),/tidak cukup/);
 assert.equal(e.sql('SELECT COUNT(*) AS n FROM world_market_trades').n,0);
 assert.equal(e.sql('SELECT balance FROM wallets WHERE user_id=?','a').balance,0);
});
caseTest('market transaction replay is a no-op',e=>{
 e.send('a','.wow starter');
 const text=e.send('a','.market buy AQUA 1',START,'purchase:1');
 assert.equal(e.send('a','.market buy AQUA 1',START,'purchase:1'),text);
 assert.equal(e.sql('SELECT COUNT(*) AS n FROM world_market_trades').n,1);
});
caseTest('arcade rewards bound V only and leave transferable wallet unchanged',e=>{
 const options=e.core; // default RNG values do not guarantee a slot match
 e.send('a','.gacha claim');
 assert.equal(e.sql('SELECT balance FROM wallets WHERE user_id=?','a').balance,0);
 assert.equal(e.sql('SELECT balance FROM world_bound_wallets WHERE user_id=?','a').balance,2);
 assert.match(e.send('a','.wow wallet'),/Arcade V terikat: 2/);
 assert.equal(e.sql('SELECT COUNT(*) AS n FROM world_bound_events WHERE delta>0').n,1);
});
test('ten-symbol match earns limited bound V but cannot mint transferable V',()=>{
 const e=env({randomInt:()=>0});try{
  assert.match(e.send('a','.slot spin'),/10 simbol identik/);
  assert.equal(e.sql('SELECT balance FROM wallets WHERE user_id=?','a').balance,0);
  assert.equal(e.sql('SELECT balance FROM world_bound_wallets WHERE user_id=?','a').balance,20);
  assert.equal(e.sql('SELECT score FROM arcade_spins').score,640);
 }finally{e.done()}
});
caseTest('bound V cosmetic purchase is deterministic and permanent',e=>{
 e.send('a','.gacha claim');
 assert.match(e.send('a','.wow buy arcade-title'),/kurang/);
 assert.equal(e.sql('SELECT COUNT(*) AS n FROM world_shop_purchases').n,0);
});
test('cosmetics can be purchased with earned bound V; spending does not create V',()=>{
 const e=env({randomInt:()=>0});try{
  e.send('a','.slot spin');e.send('a','.gacha claim');
  e.send('a','.slot spin'); // total cap 40 and repeated spins earn 20 each
  assert.equal(e.sql('SELECT balance FROM world_bound_wallets WHERE user_id=?','a').balance,40);
  assert.match(e.send('a','.wow buy arcade-title'),/telah masuk/);
  assert.equal(e.sql('SELECT balance FROM world_bound_wallets WHERE user_id=?','a').balance,15);
  assert.match(e.send('a','.wow buy arcade-title'),/sudah dimiliki/);
  assert.equal(e.sql('SELECT balance FROM wallets WHERE user_id=?','a').balance,0);
 }finally{e.done()}
});
caseTest('database reopen preserves economic state and avoids starter duplication',e=>{
 e.send('a','.wow starter');e.send('a','.mine');e.send('a','.gacha claim');
 e.reopen();
 assert.equal(e.sql('SELECT balance FROM wallets WHERE user_id=?','a').balance,81);
 assert.match(e.send('a','.wow starter'),/sudah diklaim/);
 assert.match(e.send('a','.wow wallet'),/Arcade V terikat: 2/);
});
caseTest('World/Market quick-replies are registered and <=3',()=>{
 for(const name of ['world','market']){
  assert.equal(PANELS[name].buttons.length,3);
  for(const b of PANELS[name].buttons)assert.equal(BUTTON_COMMANDS[b.id],b.command);
 }
});
test('risk room cooperative success awards bound V without touching transferable wallet',()=>{
 const e=env({randomInt:()=>0,arcadeCodeGenerator:()=> 'ABCDEF12'});try{
  e.send('a','.risk create');e.send('b','.risk join ABCDEF12');
  e.send('a','.risk choose ABCDEF12 legend');e.send('b','.risk choose ABCDEF12 safe');
  assert.match(e.send('a','.risk resolve ABCDEF12'),/Ronde selesai/);
  assert.equal(e.sql('SELECT balance FROM world_bound_wallets WHERE user_id=?','a').balance,20);
  assert.equal(e.sql('SELECT balance FROM world_bound_wallets WHERE user_id=?','b').balance,10);
  assert.equal(e.sql('SELECT balance FROM wallets WHERE user_id=?','a').balance,0);
  assert.equal(e.sql('SELECT balance FROM wallets WHERE user_id=?','b').balance,0);
 }finally{e.done()}
});
caseTest('market holdings survive restart and private portfolio is isolated',e=>{
 e.send('alice','.wow starter');e.send('alice','.market buy AQUA 1');
 e.reopen();
 assert.match(e.send('alice','.market portfolio'),/AQUA: 1/);
 assert.match(e.send('bob','.market portfolio'),/Belum punya/);
});
caseTest('external V-Currency balance cannot be purchased with bound V',e=>{
 e.send('alice','.gacha claim');
 assert.match(e.send('alice','.market buy AQUA 1'),/Saldo tidak cukup/);
 assert.equal(e.sql('SELECT balance FROM wallets WHERE user_id=?','alice').balance,0);
});
