import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIncoming,unwrap,getButtonIds} from '../src/wa/message.js';
import {fallbackText,tapCommand,legacyPayload,nativePayload,nativeRelayNodes,sendButtonExperiment} from '../src/wa/buttons.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
const msg=(message,id='abc',jid='user@s.whatsapp.net')=>({key:{remoteJid:jid,id,fromMe:false},message});
test('plain message commands and wrapped ephemeral',()=>{
 assert.deepEqual(parseIncoming(msg({conversation:'.menu'})).text,'.menu');
 assert.equal(parseIncoming(msg({extendedTextMessage:{text:'.wallet'}})).source,'text');
 assert.equal(parseIncoming(msg({ephemeralMessage:{message:{conversation:'.ping'}}})).text,'.ping');
 assert.equal(parseIncoming(msg({conversation:'Hello'})),null);
});
test('legacy, list, template and native interactive replies',()=>{
 const variants=[
  [{buttonsResponseMessage:{selectedButtonId:'waw:wallet'}},'.wallet'],
  [{templateButtonReplyMessage:{selectedId:'waw:menu'}},'.menu'],
  [{listResponseMessage:{singleSelectReply:{selectedRowId:'waw:games'}}},'.games'],
  [{interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:'{"id":"waw:games"}'}}},'.games'],
 ];
 for(const [raw,text] of variants)assert.equal(parseIncoming(msg(raw)).text,text);
 assert.equal(parseIncoming(msg({interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:'{broken'}}})),null);
 assert.equal(parseIncoming(msg({buttonsResponseMessage:{selectedButtonId:'danger:unknown'}})),null);
 assert.ok(getButtonIds().length>=13);
});
test('button payload generation and fallback remain deterministic',()=>{
 assert.equal(tapCommand('2'),'.games');assert.equal(tapCommand('4'),null);
 assert.match(fallbackText('native'),/\.tap 1/);
 assert.equal(legacyPayload().buttons.length,3);
 const make={create:x=>x};
 const fake={Message:{InteractiveMessage:Object.assign(make,{Header:make,Body:make,Footer:make,NativeFlowMessage:make})}};
 const native=nativePayload(fake);
 assert.equal(native.interactiveMessage.nativeFlowMessage.buttons.length,3);
});
test('command button route uses real core and sends expected reply',async()=>{
 const db=openDatabase(':memory:');
 const outputs=[],records=[];
 const handle=createWhatsAppHandler({core:createCore(db),sendText:async(j,t)=>outputs.push(t),sendButtons:async()=>({sent:true}),record:e=>records.push(e)});
 await handle(msg({buttonsResponseMessage:{selectedButtonId:'waw:wallet'}}));
 assert.match(outputs[0],/0 V-Currency/);assert.equal(records[0].type,'button_click');
 db.close();
});
test('button test attempts, feedback, fallback and safety gates',async()=>{
 const db=openDatabase(':memory:');const out=[],events=[],panels=[];
 const handle=createWhatsAppHandler({core:createCore(db),sendText:async(j,t)=>out.push(t),sendButtons:async(j,mode,msg,opts)=>{panels.push(opts?.panelName);return {sent:true,mode}},record:e=>events.push(e)});
 assert.equal((await handle(msg({conversation:'.buttons native'}))).mode,'native');
 assert.equal(events[0].type,'button_attempt');
 await handle(msg({conversation:'.tap 1'},'2'));
 assert.equal(panels[1],'home');
 await handle(msg({conversation:'.buttoncheck shown'},'3'));
 assert.equal(events.at(-1).outcome,'shown');
 assert.equal((await handle(msg({conversation:'.buttons native'},'group','room@g.us'))).ignored,'group-disabled');
 assert.equal((await handle({...msg({conversation:'.menu'},'self'),key:{remoteJid:'u@s.whatsapp.net',id:'self',fromMe:true}})).ignored,'outgoing/status');
 assert.equal((await handle(msg({conversation:'random chat'},'4'))).ignored,'not-command');
 db.close();
});
test('repeat same event is harmless at ledger layer',async()=>{
 const db=openDatabase(':memory:');const core=createCore(db,{randomInt:()=>0});const out=[];
 const handle=createWhatsAppHandler({core,sendText:async(j,t)=>out.push(t),sendButtons:async()=>({sent:true})});
 const m=msg({conversation:'.coin kepala'},'coin-1');
 await handle(m);await handle(m);
 assert.equal(db.prepare('SELECT balance FROM wallets').get().balance,3);
 assert.equal(out[0],out[1]);db.close();
});

test('native relay includes biz/native_flow and bot metadata; no fake menu message',async()=>{
 const sent=[],relayed=[];
 const sock={user:{id:'bot@s.whatsapp.net'},
  sendMessage:async(...args)=>sent.push(args),
  relayMessage:async(...args)=>relayed.push(args)};
 const make={create:x=>x};
 const proto={Message:{InteractiveMessage:Object.assign(make,{Header:make,Body:make,Footer:make,NativeFlowMessage:make})}};
 const baileys={proto,generateWAMessageFromContent:(jid,payload)=>({key:{id:'test-out-1'},message:payload})};
 const result=await sendButtonExperiment({sock,jid:'u@s.whatsapp.net',mode:'native',baileys});
 assert.equal(result.sent,true);
 assert.equal(result.stage,'relayed-unverified');
 assert.equal(sent.length,0,'no fake text response should precede native message');
 assert.equal(relayed.length,1);
 const [jid,content,opts]=relayed[0];
 assert.equal(jid,'u@s.whatsapp.net');
 assert.equal(content.viewOnceMessage,undefined);
 assert.equal(content.interactiveMessage.nativeFlowMessage.buttons.length,3);
 assert.equal(content.interactiveMessage.nativeFlowMessage.messageVersion,1);
 assert.equal(opts.additionalNodes[0].tag,'biz');
 assert.equal(opts.additionalNodes[0].content[0].attrs.type,'native_flow');
 assert.equal(opts.additionalNodes[1].tag,'bot');
 assert.equal(JSON.parse(content.interactiveMessage.nativeFlowMessage.buttons[0].buttonParamsJson).id,'waw:menu');
 assert.match(content.interactiveMessage.body.text,/\.tap 1/);
 assert.equal(nativeRelayNodes('g@g.us').length,1);
});
test('failed native relay sends fallback text but does not claim success',async()=>{
 const out=[];
 const make={create:x=>x};
 const proto={Message:{InteractiveMessage:Object.assign(make,{Header:make,Body:make,Footer:make,NativeFlowMessage:make})}};
 const result=await sendButtonExperiment({sock:{user:{id:'a@s.whatsapp.net'},relayMessage:async()=>{throw Error('test relay failed')},sendMessage:async(j,p)=>out.push(p)},jid:'u@s.whatsapp.net',mode:'native',baileys:{proto,generateWAMessageFromContent:()=>({key:{id:'X'},message:{interactiveMessage:{}}})}});
 assert.equal(result.sent,false);assert.equal(result.stage,'relay-failed');
 assert.equal(out.length,1);assert.match(out[0].text,/\.tap 2/);
});
test('button feedback captures mode without claiming actual render',async()=>{
 const db=openDatabase(':memory:');const events=[],responses=[];
 const handle=createWhatsAppHandler({core:createCore(db),record:e=>events.push(e),sendText:async(j,text)=>responses.push(text),sendButtons:async()=>({sent:true,stage:'relayed-unverified'})});
 await handle(msg({conversation:'.buttoncheck native hidden'},'test-2'));
 assert.equal(events[0].mode,'native');assert.equal(events[0].outcome,'hidden');
 assert.match(responses[0],/laporan dari perangkat/);db.close();
});
