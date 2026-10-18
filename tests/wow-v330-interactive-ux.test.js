import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';
import {BUTTON_COMMANDS,DM_SELECTOR_ROWS,nativePayload,nativeRelayNodes} from '../src/wa/buttons.js';
import {originalGroupMessageKey,restoreGroupMessageKey} from '../src/wa/revoke-key.js';
import {createChatIdentity} from '../src/wa/chat-identity.js';
import {createBlackjackNotifier} from '../src/wa/blackjack-notifier.js';
const A='628111111111@s.whatsapp.net',G='120363000000@g.us';
const message=(text,id='v330',jid=A)=>({key:{remoteJid:jid,id,fromMe:false},message:{conversation:text}});
const proto={Message:{InteractiveMessage:{create:x=>x,Header:{create:x=>x},Body:{create:x=>x},Footer:{create:x=>x},NativeFlowMessage:{create:x=>x}}}};
test('v3.3 DM mixed native panel presents more than three choices in selector',()=>{
 const panel=nativePayload(proto,{panelName:'home',mixed:true});
 const b=panel.interactiveMessage.nativeFlowMessage.buttons;
 assert.equal(b.length,4);assert.equal(b.filter(x=>x.name==='quick_reply').length,3);
 const select=JSON.parse(b.at(-1).buttonParamsJson);
 assert.equal(select.sections[0].rows.length,12);
 assert.equal(select.sections[0].rows[2].id,'waw:dm:bj');
 assert.deepEqual(Object.keys(DM_SELECTOR_ROWS).sort(),['bjlobby','bjplay','blackjack','games','home']);
 assert.equal(nativeRelayNodes(A).at(-1).tag,'bot');
});
test('v3.3 private selector ids are allowlisted to their real game commands',()=>{
 assert.equal(BUTTON_COMMANDS['waw:dm:bjp:hit'],'.bj hit');
 assert.equal(BUTTON_COMMANDS['waw:dm:bjp:stand'],'.bj stand');
 assert.equal(BUTTON_COMMANDS['waw:dm:bj:new'],'.bj create');
 assert.equal(BUTTON_COMMANDS['waw:dm:shop'],'.dailyshop');
 assert.equal(BUTTON_COMMANDS['waw:dm:style'],'.chatstyle');
});
test('v3.3 player DM home sends mixed selector, button click actually opens blackjack',async()=>{
 const db=openDatabase(':memory:');const core=createCore(db),panels=[],texts=[];
 const handle=createWhatsAppHandler({core,sendButtons:async(_j,mode,_q,opts)=>{panels.push({mode,...opts});return {sent:true}},sendText:async(_j,t)=>texts.push(t)});
 await handle(message('.menu','d1'));assert.equal(panels[0].mode,'mixed');assert.equal(panels[0].panelName,'home');
 await handle({key:{remoteJid:A,id:'d2',fromMe:false},message:{interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:JSON.stringify({id:'waw:dm:bj'})}}}});
 assert.equal(panels.at(-1).mode,'mixed');assert.equal(panels.at(-1).panelName,'blackjack');
 assert.match(panels.at(-1).body,/Belum masuk meja/);db.close();
});
test('v3.3 blackjack DM after lobby action and hand sends controls and private PNG',async()=>{
 const db=openDatabase(':memory:');const core=createCore(db),images=[],panels=[];
 const handle=createWhatsAppHandler({core,sendText:async()=>{},sendImage:async(j,png,caption)=>images.push({j,png,caption}),sendButtons:async(_j,mode,_q,opts)=>{panels.push({mode,...opts});return {sent:true}}});
 await handle(message('.bj create','bj1'));
 assert.equal(panels.at(-1).panelName,'bjlobby');
 await handle(message('.bj start','bj2'));
 assert.ok(images.length>=1);assert.equal(images.at(-1).j,A);
 assert.deepEqual(Array.from(images.at(-1).png.subarray(0,4)),[137,80,78,71]);
 assert.equal(panels.at(-1).mode,'mixed');
 assert.ok(['bjplay','blackjack'].includes(panels.at(-1).panelName));
 await handle(message('.bj hand','bj3'));assert.ok(images.length>=2);
 db.close();
});
test('v3.3 blackjack outbox can notify image and buttons without group card leakage',async()=>{
 let card=0,controls=0;const due=[{id:1,recipient:A,event_key:'ROOM:start:'+A,body:'READY'},
 {id:2,recipient:G,event_key:'ROOM:group-start:'+G,body:'GROUP'}];
 const notify=createBlackjackNotifier({core:{claimBlackjackNotifications:()=>due,ackBlackjackNotification:()=>{},failBlackjackNotification:()=>{}},sendText:async()=>{},sendCard:async()=>{card++},sendControls:async()=>{controls++}});
 await notify.flush();assert.equal(card,1);assert.equal(controls,1);
});
test('v3.3 revoke key from common player preserves original LID participant (no impersonation)',()=>{
 const incoming={remoteJid:G,id:'incoming-X',fromMe:false,participant:'999@lid',participantAlt:'628123@s.whatsapp.net',extra:'ignored'};
 const key=originalGroupMessageKey(incoming);
 assert.deepEqual(key,{remoteJid:G,id:'incoming-X',fromMe:false,participant:'999@lid'});
 assert.deepEqual(restoreGroupMessageKey(JSON.stringify(key),G,'incoming-X','different@s.whatsapp.net'),key);
 assert.equal(restoreGroupMessageKey(JSON.stringify(key),'other@g.us','incoming-X','different@s.whatsapp.net')?.participant,'different@s.whatsapp.net');
 assert.equal(originalGroupMessageKey({...incoming,fromMe:true}),null);
});
test('v3.3 revoking delete consent while queued downgrades to mirror, no source deletion',()=>{
 const db=openDatabase(':memory:'),core=createCore(db);core.process({senderId:A,eventKey:'register',text:'.ping'});
 const ci=createChatIdentity({db,adminIds:['owner@s.whatsapp.net'],now:()=>1000000});let n=0;
 const cmd=(sender,chat,text,isGroup=false)=>ci.command({senderId:sender,chatId:chat,text,isGroup,groupAdmin:true,eventKey:'e'+(++n),at:1000000});
 cmd('owner@s.whatsapp.net','owner@s.whatsapp.net','.admin chat global on');
 cmd('owner@s.whatsapp.net','owner@s.whatsapp.net','.admin chat replace on');
 cmd(A,A,'.chatstyle on');cmd(A,A,'.chatstyle replace on');
 cmd('owner@s.whatsapp.net',G,'.wowchat enable',true);cmd('owner@s.whatsapp.net',G,'.wowchat mode replace',true);cmd('owner@s.whatsapp.net',G,'.wowchat delete on',true);
 const accepted=ci.ingest({key:{remoteJid:G,participant:A,id:'src-common',fromMe:false},message:{conversation:'Halo'}},1000000);
 assert.equal(accepted.accepted,true);
 cmd(A,A,'.chatstyle replace off');
 const job=ci.claim(1000000);
 assert.ok(job);assert.equal(job.delete_state,'SKIPPED');
 ci.finish(job.source_key,true,'bot-ack',1000000);
 assert.equal(ci.ackDelivered({remoteJid:G,id:'bot-ack',fromMe:true},3,1000000),0);
 assert.equal(ci.claimDelete(1000000),null);db.close();
});
test('v3.3 DM .buttons mixed sends interactive diagnostic instead of text-only menu',async()=>{
 const db=openDatabase(':memory:');const panels=[];
 const handle=createWhatsAppHandler({core:createCore(db),sendText:async()=>{},sendButtons:async(_jid,mode,_quoted,options)=>{panels.push({mode,options});return {sent:true,stage:'relayed-unverified'}}});
 const out=await handle(message('.buttons mixed','btn-mixed'));
 assert.equal(out.action,'send-buttons');assert.equal(out.mode,'mixed');assert.equal(panels[0].mode,'mixed');db.close();
});
test('v3.3 Blackjack native Hit/Stand taps invoke existing game action, never a fake typed response',async()=>{
 const db=openDatabase(':memory:'),core=createCore(db),cards=[],panels=[];
 const handle=createWhatsAppHandler({core,sendText:async()=>{},sendImage:async(_,bytes)=>cards.push(bytes),sendButtons:async(_jid,mode,_quoted,options)=>{panels.push({mode,...options});return {sent:true}}});
 await handle(message('.bj create','tap-create'));await handle(message('.bj start','tap-start'));
 const interactive=id=>({key:{remoteJid:A,id:'tap-'+id,fromMe:false},message:{interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:JSON.stringify({id})}}}});
 const hit=await handle(interactive('waw:dm:bjp:hit'));
 assert.equal(hit.source,'native-button');assert.equal(hit.command,'.bj hit');
 const stand=await handle(interactive('waw:dm:bjp:stand'));
 assert.equal(stand.command,'.bj stand');
 assert.ok(cards.length>=2);assert.ok(panels.every(p=>p.mode==='mixed'));db.close();
});
