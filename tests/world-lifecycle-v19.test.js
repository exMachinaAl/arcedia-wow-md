import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {forecast} from '../src/economy-intelligence.js';
import {PANELS,BUTTON_COMMANDS} from '../src/wa/buttons.js';
const T=Date.parse('2026-10-18T10:00:00+07:00');
function fixture(opts={}){
 const dir=mkdtempSync(join(tmpdir(),'wow19-')),path=join(dir,'world.sqlite');
 let db=openDatabase(path),core=createCore(db,{randomInt:(min)=>min,arcadeCodeGenerator:()=> 'ABCD1234',...opts}),i=0;
 return {get db(){return db;},say:(id,s,when=T,key)=>core.process({senderId:id,eventKey:key??`v19:${++i}`,text:s,now:when}),reopen(){db.close();db=openDatabase(path);core=createCore(db,{randomInt:min=>min,arcadeCodeGenerator:()=> 'ABCD1234',...opts});},close(){db.close();rmSync(dir,{recursive:true,force:true});}};
}
function c(name,fn){test(name,()=>{const e=fixture();try{fn(e);}finally{e.close()}})}
const money=(e,id)=>e.db.prepare('SELECT balance FROM wallets WHERE user_id=?').get(id)?.balance??0;
c('WOW v1.9: transfer disabled from old command even after friendship',e=>{
 e.say('alice','.wow starter');e.say('bob','.wow starter');
 assert.match(e.say('alice','.pay bob 5'),/DILARANG/);
 assert.match(e.say('alice','.pay enable'),/DILARANG/);
 assert.equal(money(e,'alice'),75);assert.equal(money(e,'bob'),75);
 assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM transfers').get().n,0);
});
c('WOW v1.9: V shop burns main currency and grants usable item once per message',e=>{
 e.say('a','.wow starter');assert.match(e.say('a','.vshop buy focus-token'),/Berhasil membeli/);
 assert.equal(money(e,'a'),60);
 assert.equal(e.db.prepare("SELECT quantity FROM item_stacks WHERE user_id='a' AND item_id='focus-token'").get().quantity,1);
 assert.equal(e.db.prepare("SELECT delta FROM wow_v_events WHERE reason='shop:focus-token'").get().delta,-15);
});
c('WOW v1.9: V shop cannot overspend or mint and replay does nothing',e=>{
 assert.match(e.say('a','.vshop buy hint-scroll'),/tidak cukup/);
 assert.equal(money(e,'a'),0);e.say('a','.wow starter');
 const msg=e.say('a','.vshop buy hint-scroll',T,'once');assert.equal(e.say('a','.vshop buy hint-scroll',T,'once'),msg);
 assert.equal(money(e,'a'),55);assert.equal(e.db.prepare("SELECT quantity FROM item_stacks WHERE item_id='hint-scroll'").get().quantity,1);
});
c('WOW v1.9: game income and V shop share exactly same main wallet',e=>{
 e.say('a','.mine');assert.equal(money(e,'a'),6);
 e.say('a','.work complete');assert.equal(money(e,'a'),18);
 assert.match(e.say('a','.vshop buy focus-token'),/Berhasil/);assert.equal(money(e,'a'),3);
});
c('WOW v1.9: mining material migration is once-only and persistent',e=>{
 e.say('a','.mine');e.say('a','.mine');e.say('a','.mine');
 assert.match(e.say('a','.craft'),/Copper 1/);
 assert.match(e.say('a','.craft'),/Iron 1/);
 assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM wow_material_claims').get().n,3);
 e.reopen();e.say('a','.craft');assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM wow_material_claims').get().n,3);
});
c('WOW v1.9: crafting costs resources & main V and stays persistent',e=>{
 e.say('a','.wow starter');e.say('a','.mine');e.say('a','.mine',T+86400000);
 assert.match(e.say('a','.craft make copper-badge'),/berhasil dibuat/);
 assert.equal(money(e,'a'),72);
 assert.match(e.say('a','.craft make copper-badge'),/sudah dimiliki/);
 e.reopen();assert.match(e.say('a','.collection wow'),/copper-badge/);
});
c('WOW v1.9: profession shifts one daily reward; no switching to farm',e=>{
 assert.match(e.say('a','.career shift'),/Pilih profesi/);
 assert.match(e.say('a','.career choose artisan'),/dipilih/);
 assert.match(e.say('a','.career shift'),/\+12 V/);
 assert.match(e.say('a','.career shift'),/sudah selesai/);
 assert.match(e.say('a','.career choose miner'),/sudah artisan/);
 assert.equal(money(e,'a'),12);
});
c('WOW v1.9: V arcade is explicit opt-in and can be disabled',e=>{
 e.say('a','.wow starter');assert.match(e.say('a','.slot v'),/opt-in/);
 assert.match(e.say('a','.arcade v enable'),/aktif/);
 assert.match(e.say('a','.arcade v disable'),/dinonaktifkan/);
 assert.match(e.say('a','.slot v'),/opt-in/);
 assert.equal(money(e,'a'),75);
});
c('WOW v1.9: slot stake paid in main V, returns capped payout & full record',e=>{
 e.say('a','.wow starter');e.say('a','.arcade v enable');
 assert.match(e.say('a','.slot v'),/10\/10/);
 assert.equal(money(e,'a'),75-5+100);
 assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM wow_arcade_spins').get().n,1);
 assert.equal(e.db.prepare("SELECT COALESCE(SUM(delta),0) AS n FROM wow_v_events WHERE reason='arcade-stake:slot'").get().n,-5);
 assert.match(e.say('a','.slot v odds'),/Peluang|Rentetan/);
});
c('WOW v1.9: arcade stake/day and payout/day limits cannot be bypassed',e=>{
 e.say('a','.wow starter');e.say('a','.arcade v enable');
 for(let i=0;i<5;i++)e.say('a','.slot v');
 assert.match(e.say('a','.slot v'),/Batas pengeluaran/);
 assert.equal(e.db.prepare("SELECT COALESCE(SUM(delta),0) AS n FROM wow_v_events WHERE reason LIKE 'arcade-stake:%'").get().n,-25);
 assert.equal(e.db.prepare("SELECT COALESCE(SUM(delta),0) AS n FROM wow_v_events WHERE reason LIKE 'arcade-win:%'").get().n,100);
});
c('WOW v1.9: risk V two players shared RNG pays and persists',e=>{
 for(const id of ['a','b']){e.say(id,'.wow starter');e.say(id,'.arcade v enable');}
 assert.match(e.say('a','.risk v create'),/ABCD1234/);
 assert.match(e.say('b','.risk v join ABCD1234'),/bergabung/);
 assert.match(e.say('a','.risk v choose ABCD1234 safe'),/70%/);
 assert.match(e.say('b','.risk v choose ABCD1234 legend'),/10%/);
 assert.match(e.say('a','.risk v resolve ABCD1234'),/selesai/);
 assert.equal(money(e,'a'),75-5+6);assert.equal(money(e,'b'),75-5+30);
 e.reopen();assert.match(e.say('a','.risk v status ABCD1234'),/DONE/);
});
c('WOW v1.9: V risk cannot resolve without all players choosing',e=>{
 for(const id of ['a','b']){e.say(id,'.wow starter');e.say(id,'.arcade v enable');}
 e.say('a','.risk v create');e.say('b','.risk v join ABCD1234');
 assert.match(e.say('a','.risk v resolve ABCD1234'),/wajib memilih/);
 assert.equal(money(e,'b'),70);
});
c('WOW v1.9: risk cancel refunds everyone exactly once',e=>{
 for(const id of ['a','b']){e.say(id,'.wow starter');e.say(id,'.arcade v enable');}
 e.say('a','.risk v create');e.say('b','.risk v join ABCD1234');
 assert.match(e.say('a','.risk v cancel ABCD1234'),/dikembalikan/);
 assert.match(e.say('a','.risk v cancel ABCD1234'),/CANCELLED/);
 assert.equal(money(e,'a'),75);assert.equal(money(e,'b'),75);
});
c('WOW v1.9: V risk nonmember cannot see or join full room',e=>{
 for(const id of ['a','b','c','d','e']){e.say(id,'.wow starter');e.say(id,'.arcade v enable');}
 e.say('a','.risk v create');for(const id of ['b','c','d'])e.say(id,'.risk v join ABCD1234');
 assert.match(e.say('e','.risk v join ABCD1234'),/penuh/);
 assert.match(e.say('e','.risk v status ABCD1234'),/Hanya peserta/);
 assert.equal(money(e,'e'),75);
});
c('WOW v1.9: no real currency conversion commands or player transfers',e=>{
 e.say('a','.wow starter');
 for(const command of ['.pay enable','.pay Foo 20','.topup 100','.cashout','.withdraw','.sendv Foo 1']){
   const before=money(e,'a'),response=e.say('a',command);
   assert.equal(money(e,'a'),before);assert.ok(response.length);
 }
});
c('WOW v1.9: synthetic local ML evaluation provides baseline guard',e=>{
 const r=forecast('NOVA',T);assert.ok(['linear-regression','naive-last-price'].includes(r.model));
 assert.ok(r.evaluation.modelMAE>=0);assert.ok(r.evaluation.baselineMAE>=0);
 assert.match(e.say('a','.market forecast NOVA'),/DATA FIKTIF/);
 assert.equal(forecast('INVALID',T),null);
});
test('WOW v1.9 native panel buttons remain <=3 and mapped',()=>{
 assert.ok(PANELS.world);for(const p of Object.values(PANELS)){
  assert.ok(p.buttons.length<=3);for(const button of p.buttons)assert.equal(BUTTON_COMMANDS[button.id],button.command);
 }
});
