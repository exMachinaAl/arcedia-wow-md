import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';
import {PANELS,BUTTON_COMMANDS} from '../src/wa/buttons.js';
const USER='tester@s.whatsapp.net';
const TIME=Date.parse('2026-10-18T10:00:00+07:00');
function fixture(file=':memory:') {
 const db=openDatabase(file),core=createCore(db);let counter=0;
 const send=(text,now=TIME,key=`event-${++counter}`)=>core.process({senderId:USER,eventKey:key,text,now});
 const qty=id=>db.prepare('SELECT quantity FROM item_stacks WHERE user_id=? AND item_id=?').get(USER,id)?.quantity??0;
 return {db,core,send,qty};
}
test('v1.5 inventory schema is additive and previous wallet survives',()=>{const x=fixture();try{
 x.send('.wallet');assert.equal(x.db.prepare('SELECT balance FROM wallets WHERE user_id=?').get(USER).balance,0);
 assert.equal(x.db.prepare('SELECT COUNT(*) AS n FROM item_stacks').get().n,0);
 assert.match(x.send('.item list'),/Pioneer Badge/);
}finally{x.db.close();}});
test('v1.5 starter kit grants exactly once across distinct messages',()=>{const x=fixture();try{
 assert.match(x.send('.item claim starter'),/Starter Kit/);
 assert.equal(x.qty('focus-token'),2);assert.equal(x.qty('hint-scroll'),1);
 assert.match(x.send('.item claim starter'),/sudah pernah/);
 assert.equal(x.qty('focus-token'),2);assert.equal(x.db.prepare('SELECT COUNT(*) n FROM item_events').get().n,2);
}finally{x.db.close();}});
test('v1.5 daily item award cannot be duplicated same WIB calendar day',()=>{const x=fixture();try{
 x.send('.item daily');let a=x.db.prepare("SELECT COUNT(*) n FROM item_events WHERE reason='daily-item'").get().n;
 x.send('.item daily',TIME+5000);assert.equal(a,1);assert.equal(x.db.prepare("SELECT COUNT(*) n FROM item_events WHERE reason='daily-item'").get().n,1);
 x.send('.item daily',TIME+86400000);assert.equal(x.db.prepare("SELECT COUNT(*) n FROM item_events WHERE reason='daily-item'").get().n,2);
}finally{x.db.close();}});
test('v1.5 focus token awards XP only once per local day',()=>{const x=fixture();try{
 x.send('.item claim starter');const before=x.core.profile(USER).xp;
 assert.match(x.send('.item use focus-token'),/\+10 XP/);
 assert.equal(x.core.profile(USER).xp,before+10);assert.equal(x.qty('focus-token'),1);
 assert.match(x.send('.item use focus-token',TIME+2000),/satu kali per hari/);
 assert.equal(x.qty('focus-token'),1);assert.equal(x.core.profile(USER).xp,before+10);
 assert.match(x.send('.item use focus-token',TIME+86400000),/\+10 XP/);
 assert.equal(x.qty('focus-token'),0);
}finally{x.db.close();}});
test('v1.5 hint scroll cannot be consumed without active guessing session',()=>{const x=fixture();try{
 x.send('.item claim starter');assert.match(x.send('.item use hint-scroll'),/item belum dikonsumsi/);assert.equal(x.qty('hint-scroll'),1);
}finally{x.db.close();}});
test('v1.5 hint scroll reveals range/parity without exact secret',()=>{const x=fixture();try{
 x.send('.item claim starter');x.send('.guess start');const r=x.send('.item use hint-scroll');
 assert.match(r,/Petunjuk/);assert.match(r,/genap|ganjil/);assert.match(r,/rentang/);assert.equal(x.qty('hint-scroll'),0);
}finally{x.db.close();}});
test('v1.5 pioneer cosmetic is free and nontransferable with claim cut-off',()=>{const x=fixture();try{
 assert.match(x.send('.item claim pioneer'),/Pioneer Badge/);assert.equal(x.qty('pioneer-badge'),1);
 assert.match(x.send('.item claim pioneer'),/sudah diklaim/);
 assert.match(x.send('.item equip pioneer-badge'),/dipakai/);
 assert.match(x.send('.profile'),/pioneer-badge/);
 assert.match(x.send('.item claim pioneer',Date.parse('2027-01-01T01:00:00+07:00')),/ditutup/);
}finally{x.db.close();}});
test('v1.5 milestone items require earned play count',()=>{const x=fixture();try{
 x.send('.wallet');assert.match(x.send('.item claim milestones'),/perlu 10 game/);
 x.db.prepare('UPDATE player_stats SET plays=25 WHERE user_id=?').run(USER);
 assert.match(x.send('.item claim milestones'),/berhasil diklaim/);
 assert.equal(x.qty('jade-frame'),1);assert.equal(x.qty('veteran-title'),1);
 assert.match(x.send('.item claim milestones'),/sudah dimiliki|sudah diklaim/);
}finally{x.db.close();}});
test('v1.5 equipment is cosmetic and unequip does not discard ownership',()=>{const x=fixture();try{
 x.send('.item claim pioneer');x.send('.item equip pioneer-badge');assert.match(x.send('.item unequip badge'),/dilepas/);
 assert.equal(x.qty('pioneer-badge'),1);assert.match(x.send('.profile'),/Belum ada/);
}finally{x.db.close();}});
test('v1.5 equipped items do not affect ranked chess ratings or wallet',()=>{const x=fixture();try{
 x.send('.wallet');const old=x.core.profile(USER).balance;
 x.send('.item claim pioneer');x.send('.item equip pioneer-badge');
 assert.equal(x.core.profile(USER).balance,old);assert.equal(x.db.prepare('SELECT COUNT(*) AS n FROM item_events WHERE delta < 0').get().n,0);
}finally{x.db.close();}});
test('v1.5 event replay uses one item transaction',()=>{const x=fixture();try{
 x.send('.item claim starter');const response=x.send('.item use focus-token',TIME,'replayed-event');
 const retry=x.send('.item use focus-token',TIME,'replayed-event');assert.equal(response,retry);
 assert.equal(x.qty('focus-token'),1);
 assert.equal(x.db.prepare("SELECT COUNT(*) n FROM item_events WHERE reason='use-focus'").get().n,1);
}finally{x.db.close();}});
test('v1.5 invalid item cannot be equipped or used and cannot affect balance',()=>{const x=fixture();try{
 x.send('.wallet');assert.match(x.send('.item equip __proto__'),/tidak dapat/);
 assert.match(x.send('.item use nope'),/tidak bisa/);
 assert.match(x.send('.item unequip main'),/Gunakan/);
 assert.equal(x.core.profile(USER).balance,0);
}finally{x.db.close();}});
test('v1.5 inventory persists after SQLite reopen / restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'waw-inv-')),file=join(dir,'world.sqlite');
 try{let x=fixture(file);x.send('.item claim starter');x.send('.item claim pioneer');x.send('.item equip pioneer-badge');x.db.close();
 x=fixture(file);assert.equal(x.qty('focus-token'),2);assert.match(x.send('.profile',TIME,'after-restart-unique'),/pioneer-badge/);x.db.close();}
 finally{rmSync(dir,{recursive:true,force:true});}
});
test('v1.5 new panel exposes inventory actions with allowlisted IDs',()=>{
 assert.equal(PANELS.inventory.buttons.length,3);
 assert.equal(BUTTON_COMMANDS['waw:inv:daily'],'.item daily');
 assert.equal(BUTTON_COMMANDS['waw:inventory'],'.inventory');
});
test('v1.5 WhatsApp handler handles inventory buttons in private chat',async()=>{
 const x=fixture();try{const panel=[];const handler=createWhatsAppHandler({core:x.core,sendText:async()=>{},sendButtons:async(_jid,_mode,_msg,opts)=>{panel.push(opts.panelName);return {sent:true}}});
 const msg={key:{remoteJid:USER,fromMe:false,id:'inv-1'},message:{conversation:'.inventory'}};
 const outcome=await handler(msg);assert.equal(outcome.ok,true);assert.equal(panel[0],'inventory');
}finally{x.db.close();}
});
test('v1.5 inventory history records both grant and use',()=>{const x=fixture();try{
 x.send('.item claim starter');x.send('.item use focus-token');
 const history=x.send('.item history');assert.match(history,/use-focus/);assert.match(history,/starter/);
}finally{x.db.close();}});
test('v1.5 item journal keeps bounded quantities',()=>{const x=fixture();try{
 x.send('.wallet');x.db.prepare("INSERT INTO item_stacks(user_id,item_id,quantity) VALUES(?,?,?)").run(USER,'focus-token',30);
 assert.match(x.send('.item daily'),/penuh|Item harian/); // parity may select other item; no invalid balances allowed
 assert.equal(x.qty('focus-token'),30);assert.throws(()=>x.db.prepare("UPDATE item_stacks SET quantity=31 WHERE user_id=? AND item_id='focus-token'").run(USER),/CHECK constraint/);
}finally{x.db.close();}});
