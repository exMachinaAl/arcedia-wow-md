import test from 'node:test';
import assert from 'node:assert/strict';
import {createWhatsAppHandler} from '../src/wa/handler.js';
import {nativePayload,GROUP_NAV_PANELS,GROUP_BUTTON_SAFE_IDS} from '../src/wa/buttons.js';
import {parseIncoming} from '../src/wa/message.js';
import {groupReceiptToDelivery} from '../src/wa/receipt.js';
import {openDatabase} from '../src/db.js';
import {createChatIdentity} from '../src/wa/chat-identity.js';
const G='120363123456@g.us',U='628100099@s.whatsapp.net';
const raw=(id,text)=>({key:{remoteJid:G,participant:U,id,fromMe:false},message:{conversation:text}});
const select=(key,id)=>({key:{remoteJid:G,participant:U,id:key,fromMe:false},message:{interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:JSON.stringify({id})}}}});
function setup(){
 const db=openDatabase(':memory:');const panels=[],messages=[],calls=[];
 const core={process:args=>{calls.push(args);return `RENDERED ${args.text}`;}};
 const h=createWhatsAppHandler({core,allowGroups:true,allowSender:()=>false,groupButtonsEnabled:false,sendText:async(_j,t)=>messages.push(t),sendButtons:async(_j,mode,_q,opts)=>{panels.push({mode,...opts});return {sent:true,stage:'relayed-unverified'};}});
 return {db,h,panels,messages,calls};
}
test('clicked Games must run real game command and show DIFFERENT selector from root',async()=>{
 const s=setup();await s.h(raw('m','.menu'));
 assert.equal(s.panels[0].panelName,'groupdemo');assert.match(s.panels[0].body,/RENDERED \.menu/);
 const r=await s.h(select('s','waw:games'));
 assert.equal(r.panel,'groupgames');assert.equal(r.command,'.games');
 assert.equal(s.calls.at(-1).text,'.games');assert.match(s.panels.at(-1).body,/RENDERED \.games/);
 assert.notEqual(s.panels[0].panelName,s.panels[1].panelName);s.db.close();
});
test('nested selectors really navigate and do not fall back to groupdemo',async()=>{
 const s=setup();
 assert.equal((await s.h(select('a','waw:more:nav'))).panel,'groupmore');
 assert.equal((await s.h(select('b','waw:more:next'))).panel,'groupexplore');
 assert.equal((await s.h(select('c','waw:arena:nav'))).panel,'grouparena');
 assert.equal((await s.h(select('d','waw:g:list'))).panel,'groupgames');
 assert.equal(s.calls.at(-1).text,'.games all');s.db.close();
});
test('public world selection executes intended core command in group',async()=>{
 const s=setup();const r=await s.h(select('world','waw:ws:pulse'));
 assert.equal(r.action,'group-public-action');assert.equal(s.calls[0].text,'.worldpulse');assert.match(s.messages[0],/RENDERED \.worldpulse/);
 assert.equal(s.panels.length,0);s.db.close();
});
test('private menu selections give clear DM guidance, never resend root menu',async()=>{
 const s=setup();const r=await s.h(select('shop','waw:ws:shop'));
 assert.equal(r.action,'group-dm-guidance');assert.equal(s.panels.length,0);assert.match(s.messages[0],/\.dailyshop/);s.db.close();
});
test('group admin commands do not become available via forged button IDs',async()=>{
 const s=setup();assert.equal((await s.h(raw('admin','.admin grant me 500'))).ignored,'not-allowed');
 assert.equal(parseIncoming(select('forge','waw:fake:admin')),null);
 assert.equal((await s.h(select('forged','waw:fake:admin'))).ignored,'not-allowed');s.db.close();
});
test('all nested group buttons are mapped, allowlisted and selectors differ',()=>{
 const create=o=>o,IM={create,Header:{create},Body:{create},Footer:{create},NativeFlowMessage:{create}};
 const proto={Message:{InteractiveMessage:IM}};
 const distinct=[];
 for(const [name,p] of Object.entries(GROUP_NAV_PANELS)){
  const payload=nativePayload(proto,{panelName:name,mixed:true}).interactiveMessage;
  const btns=payload.nativeFlowMessage.buttons;
  assert.equal(btns.filter(b=>b.name==='quick_reply').length,3);
  const rows=JSON.parse(btns.at(-1).buttonParamsJson).sections[0].rows;
  assert.equal(rows.length,p.rows.length);assert.ok(rows.every(row=>GROUP_BUTTON_SAFE_IDS.has(row.id)));
  for(const id of [...p.buttons,...p.rows].map(x=>x.id))assert.ok(parseIncoming(select('id',id))?.text);
  distinct.push(rows.map(x=>x.id).join(','));
 }
 assert.equal(new Set(distinct).size,distinct.length);
});
test('group receipt adapter requires actual recipient timestamps and matching group outgoing key',()=>{
 const key={remoteJid:G,id:'bot-msg',fromMe:true};
 assert.equal(groupReceiptToDelivery({key,receipt:{}}),null);
 assert.equal(groupReceiptToDelivery({key:{...key,fromMe:false},receipt:{receiptTimestamp:123}}),null);
 assert.equal(groupReceiptToDelivery({key:{...key,remoteJid:U},receipt:{receiptTimestamp:123}}),null);
 assert.deepEqual(groupReceiptToDelivery({key,receipt:{receiptTimestamp:123}}),{key,status:3});
 assert.deepEqual(groupReceiptToDelivery({key,receipt:{readTimestamp:124}}),{key,status:4});
});
test('unrelated group receipt never authorizes deletion, valid receipt only unlocks matching message',()=>{
 const db=openDatabase(':memory:'),id=createChatIdentity({db,adminIds:[U],now:()=>1000000});
 let seq=0;const cmd=(text,isGroup=false)=>id.command({senderId:U,chatId:isGroup?G:U,isGroup,groupAdmin:true,eventKey:`v324:${++seq}`,text,at:1000000});
 cmd('.admin chat global on');cmd('.admin chat replace on');cmd('.chatstyle on');cmd('.chatstyle replace on');
 cmd('.wowchat enable',true);cmd('.wowchat mode replace',true);cmd('.wowchat delete on',true);
 const a=id.ingest(raw('player-source','Hello WOW'),1000000);assert.equal(a.accepted,true);
 const job=id.claim(1000000);assert.ok(job);id.finish(job.source_key,true,'bot-mirror',1000000);
 assert.equal(id.claimDelete(1000000),null);
 const wrong=groupReceiptToDelivery({key:{remoteJid:G,id:'unrelated',fromMe:true},receipt:{receiptTimestamp:123}});
 assert.equal(id.ackDelivered(wrong.key,wrong.status,1000000),0);
 const correct=groupReceiptToDelivery({key:{remoteJid:G,id:'bot-mirror',fromMe:true},receipt:{receiptTimestamp:123}});
 assert.equal(id.ackDelivered(correct.key,correct.status,1000000),1);
 assert.equal(id.claimDelete(1000000)?.key?.id,'player-source');db.close();
});
import {isVerifiedBotGroupAdmin} from '../src/wa/group-admin.js';
test('bot group admin requires verified exact WhatsApp metadata identity, not player admin status',()=>{
 assert.equal(isVerifiedBotGroupAdmin({id:'bot:12@s.whatsapp.net',lid:'111@lid'},[{id:'111@lid',admin:'admin'}]),true);
 assert.equal(isVerifiedBotGroupAdmin({id:'bot@s.whatsapp.net'},[{id:'other@s.whatsapp.net',admin:'superadmin'}]),false);
 assert.equal(isVerifiedBotGroupAdmin({id:'bot@s.whatsapp.net'},[{id:'bot@s.whatsapp.net',admin:null}]),false);
 assert.equal(isVerifiedBotGroupAdmin({id:'bot@s.whatsapp.net'},[{id:'bot@s.whatsapp.net',admin:'superadmin'}]),true);
});
test('admin diagnosis reports bot admin verification without exposing private identifiers',async()=>{
 const s=setup();
 // stub chat identity and admin metadata checks for one diagnostic command
 const h=createWhatsAppHandler({core:{process:()=>''},allowGroups:true,allowSender:()=>true,
 chatIdentity:{command:()=> 'DIAGNOSE',acceptsGroup:()=>true},
 getGroupAdmin:async()=>true,getBotGroupAdmin:async()=>false,
 sendText:async(_j,t)=>s.messages.push(t),sendButtons:async()=>({sent:true})});
 const r=await h(raw('diag','.wowchat diagnose'));
 assert.equal(r.action,'wowchat-command');assert.match(s.messages.at(-1),/Bot admin grup: TIDAK/);s.db.close();
});
