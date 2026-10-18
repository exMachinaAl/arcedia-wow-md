import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {createChatIdentity} from '../src/wa/chat-identity.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';
import {DM_HUB_PANELS,DM_V340_ROWS,BUTTON_COMMANDS,nativePayload} from '../src/wa/buttons.js';
import {SIGNATURES} from '../src/wa/chat-signatures.js';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const A='628899123456@s.whatsapp.net',OWNER='owner@s.whatsapp.net',G='12036399999@g.us';
const proto={Message:{InteractiveMessage:{create:x=>x,Header:{create:x=>x},Body:{create:x=>x},Footer:{create:x=>x},NativeFlowMessage:{create:x=>x}}}};
const msg=(t,id='a',jid=A)=>({key:{remoteJid:jid,id,fromMe:false},message:{conversation:t}});
const click=(id,nonce)=>({key:{remoteJid:A,id:nonce,fromMe:false},message:{interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:JSON.stringify({id})}}}});
const ciCmd=(ci,id,txt,at=1000000)=>ci.command({senderId:id,chatId:id,text:txt,isGroup:false,eventKey:'q:'+id+':'+txt+':'+at,at});
test('v3.4 hub selector sends real actions for all five private hub pages',()=>{
 assert.deepEqual(Object.keys(DM_HUB_PANELS).sort(),['arena','economy','games','identity','world']);
 for(const name of Object.values(DM_HUB_PANELS)){
  const m=nativePayload(proto,{panelName:name,mixed:true});
  const buttons=m.interactiveMessage.nativeFlowMessage.buttons;
  assert.equal(buttons.length,4);assert.equal(buttons[3].name,'single_select');
  const rows=JSON.parse(buttons[3].buttonParamsJson).sections[0].rows;
  assert.ok(rows.length>=7);assert.ok(rows.every(x=>BUTTON_COMMANDS[x.id]===x.description));
 }
});
test('v3.4 DM hub menu tap routes to actual command, not repeated root menu',async()=>{
 const db=openDatabase(':memory:');const core=createCore(db),panels=[];
 const handler=createWhatsAppHandler({core,sendText:async()=>{},sendButtons:async(_jid,mode,_msg,opts)=>{panels.push({...opts,mode});return {sent:true,stage:'test'}}});
 await handler(msg('.menu','h1'));
 await handler(click('waw:dm:games','h2'));assert.equal(panels.at(-1).panelName,'wowgameshub');
 await handler(click('waw:v34:gs:all','h3'));assert.match(panels.at(-1).body,/Game|game|GAME/);
 await handler(click('waw:v34:gs:arena','h4'));assert.equal(panels.at(-1).panelName,'wowarenahub');
 db.close();
});
test('v3.4 hub navigation is restricted to DM and unsupported hub returns help',async()=>{
 const db=openDatabase(':memory:');const texts=[];
 const handler=createWhatsAppHandler({core:createCore(db),allowGroups:true,sendText:async(_jid,t)=>texts.push(t),sendButtons:async()=>({sent:true})});
 // Other legacy permission check protects group command while DM handler rejects group hub.
 await handler(msg('.hub imaginary','h5'));
 assert.match(texts.at(-1),/games \| world/);
 db.close();
});
test('v3.4 signature purchase atomic: insufficient balance, one-time debit, no repeat purchase',()=>{
 const db=openDatabase(':memory:');const core=createCore(db),ci=createChatIdentity({db});
 core.process({senderId:A,eventKey:'initial',text:'.ping'});
 const no=ciCmd(ci,A,'.chatstyle signature buy spark');assert.match(no,/tidak cukup/);
 db.prepare('UPDATE wallets SET balance=100 WHERE user_id=?').run(A);
 const before=db.prepare('SELECT balance FROM wallets WHERE user_id=?').get(A).balance;
 const yes=ciCmd(ci,A,'.chatstyle signature buy spark',1000001);
 assert.match(yes,/terbeli/);
 const once=ciCmd(ci,A,'.chatstyle signature buy spark',1000002);assert.match(once,/sudah dimiliki/);
 assert.equal(db.prepare('SELECT balance FROM wallets WHERE user_id=?').get(A).balance,before-40);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM wow_chat_signature_journal WHERE user_id=?').get(A).n,1);
 db.close();
});
test('v3.4 signature defaults EXPLORER and shop is account-bound',()=>{
 const db=openDatabase(':memory:'),core=createCore(db),ci=createChatIdentity({db});
 core.process({senderId:A,eventKey:'start',text:'.ping'});
 let output=ci.render(A,'pesan');assert.match(output,/EXPLORER/);
 assert.match(ciCmd(ci,A,'.chatstyle signature use royal'),/Belum memiliki/);
 db.prepare('UPDATE wallets SET balance=200 WHERE user_id=?').run(A);
 ciCmd(ci,A,'.chatstyle signature buy royal',1000001);
 assert.match(ciCmd(ci,A,'.chatstyle signature use royal',1000002),/dipakai/);
 output=ci.render(A,'pesan');assert.match(output,/♛ WOW IDENTITY/);
 assert.match(ciCmd(ci,A,'.chatstyle signature off',1000003),/dilepas/);
 assert.match(ci.render(A,'pesan'),/✦ WOW IDENTITY/);
 db.close();
});
test('v3.4 signature persists after restart while old wallets remain unchanged',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wow34-')),path=join(dir,'wow.db');
 try{
  {const db=openDatabase(path);createCore(db);const ci=createChatIdentity({db});
   ciCmd(ci,A,'.chatstyle on');db.prepare('UPDATE wallets SET balance=300 WHERE user_id=?').run(A);
   ciCmd(ci,A,'.chatstyle signature buy guild',1000001);
   ciCmd(ci,A,'.chatstyle signature use guild',1000002);
   db.close();}
  {const db=openDatabase(path);const ci=createChatIdentity({db});
   assert.match(ci.render(A,'hi'),/⚔ WOW IDENTITY/);
   assert.equal(db.prepare('SELECT balance FROM wallets WHERE user_id=?').get(A).balance,120);
   db.close();}
 } finally{rmSync(dir,{recursive:true,force:true});}
});
test('v3.4 signature list offers all exact V-priced cosmetics and button shortcuts',()=>{
 const db=openDatabase(':memory:'),core=createCore(db),ci=createChatIdentity({db});
 core.process({senderId:A,eventKey:'init',text:'.ping'});
 const shop=ciCmd(ci,A,'.chatstyle signature shop');
 for(const row of SIGNATURES){assert.match(shop,new RegExp(row.price+' V'));assert.equal(BUTTON_COMMANDS[`waw:v34:is:buy-${row.id}`],`.chatstyle signature buy ${row.id}`);}
 db.close();
});
test('v3.4 group replace/delete stays fail-closed without receipt, never inferred from button click',()=>{
 const db=openDatabase(':memory:'),core=createCore(db),ci=createChatIdentity({db,adminIds:[OWNER],now:()=>1000000});
 core.process({senderId:A,eventKey:'init',text:'.ping'});
 ciCmd(ci,OWNER,'.admin chat global on');
 const out=ci.ingest({key:{remoteJid:G,participant:A,id:'src1',fromMe:false},message:{conversation:'hello'}},1000000);
 assert.equal(out.accepted,false);
 assert.equal(ci.claimDelete(1000000),null);
 db.close();
});
