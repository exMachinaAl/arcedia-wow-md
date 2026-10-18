import test from 'node:test';
import assert from 'node:assert/strict';
import {nativePayload,nativeRelayNodes,sendButtonExperiment,GROUP_MIXED_ROWS,GROUP_BUTTON_SAFE_IDS} from '../src/wa/buttons.js';
import {parseIncoming} from '../src/wa/message.js';
import {createGroupButtonLab} from '../src/wa/group-buttons.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';
import {createCore} from '../src/core.js';
import {openDatabase} from '../src/db.js';
const G='120363000000000@g.us',U='628800000000@s.whatsapp.net';
const create=x=>x;
const proto={Message:{InteractiveMessage:{create,Header:{create},Body:{create},Footer:{create},NativeFlowMessage:{create}}}};
const incoming=(id,text)=>({key:{remoteJid:G,participant:U,fromMe:false,id},message:{conversation:text}});
test('v3.2.2 mixed 3 quick replies and 8-row selector are different structures',()=>{
 const p=nativePayload(proto,{panelName:'groupdemo',mixed:true}).interactiveMessage;
 const buttons=p.nativeFlowMessage.buttons;
 assert.equal(buttons.length,4);
 assert.deepEqual(buttons.map(x=>x.name),['quick_reply','quick_reply','quick_reply','single_select']);
 const select=JSON.parse(buttons[3].buttonParamsJson);
 assert.equal(select.sections[0].rows.length,12);
 assert.equal(GROUP_MIXED_ROWS.length,12);
 assert.ok(select.sections[0].rows.every(x=>GROUP_BUTTON_SAFE_IDS.has(x.id)));
 assert.equal(JSON.parse(p.nativeFlowMessage.messageParamsJson).bottom_sheet.in_thread_buttons_limit,2);
});
test('v3.2.2 all eight option IDs are allowlisted incoming commands',()=>{
 for(const row of GROUP_MIXED_ROWS){
  const msg={message:{interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:JSON.stringify({id:row.id})}}}};
  assert.equal(parseIncoming(msg)?.text,row.command);
 }
 assert.equal(parseIncoming({message:{interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:'{"id":"admin:grant"}'}}}}),null);
});
test('v3.2.2 mixed relay reference uses only biz/native_flow wrapper without bot private node',()=>{
 const nodes=nativeRelayNodes(G,1666000000,'reference');
 assert.equal(nodes.length,1);
 assert.deepEqual(nodes[0].attrs,{});
 assert.equal(nodes[0].content[0].tag,'interactive');
 assert.equal(nodes[0].content[0].content[0].attrs.name,'mixed');
 assert.notDeepEqual(nativeRelayNodes(G)[0].attrs,{});
});
test('v3.2.2 mixed transport sends one native-flow message, not secondary text',async()=>{
 const relayed=[],sent=[];
 const sock={user:{id:'bot@s.whatsapp.net'},relayMessage:async(...x)=>relayed.push(x),sendMessage:async(...x)=>sent.push(x)};
 const out=await sendButtonExperiment({sock,jid:G,mode:'mixed',baileys:{proto,generateWAMessageFromContent:(jid,message)=>({message,key:{id:'mixedid'}})},panelName:'groupdemo'});
 assert.equal(out.sent,true);assert.equal(relayed.length,1);assert.equal(sent.length,0);
 assert.equal(relayed[0][2].messageId,'mixedid');
 assert.equal(relayed[0][1].interactiveMessage.nativeFlowMessage.buttons.length,4);
});
test('v3.2.2 group lab mixed restricted admin and shares cooldown',async()=>{
 let t=4000000;const calls=[];const texts=[];
 const lab=createGroupButtonLab({enabled:true,now:()=>t});
 const opts={jid:G,sender:U,text:'.groupbuttons mixed',sendText:async(j,t)=>texts.push(t),sendButtons:async(...x)=>{calls.push(x);return {sent:true,stage:'relayed-unverified'};}};
 assert.equal((await lab.handle({...opts,groupAdmin:false})).ok,false);
 assert.equal(calls.length,0);
 assert.equal((await lab.handle({...opts,groupAdmin:true})).mode,'mixed');
 assert.equal(calls[0][1],'mixed');
 assert.equal((await lab.handle({...opts,groupAdmin:true})).reason,'rate-limit');
 t+=61000;
 assert.equal((await lab.handle({...opts,text:'.groupbuttons selector',groupAdmin:true})).mode,'selector');
});
test('v3.2.2 allow common group player safe clicked navigation while admin commands stay restricted',async()=>{
 const db=openDatabase(':memory:');const sent=[],panels=[];
 const h=createWhatsAppHandler({core:createCore(db),allowGroups:true,groupButtonsEnabled:true,
  allowSender:()=>false,sendText:async(j,text)=>sent.push(text),sendButtons:async(...args)=>{panels.push(args);return {sent:true}}});
 const safe={key:{remoteJid:G,participant:U,id:'safe',fromMe:false},message:{interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:'{"id":"waw:games"}'}}}};
 assert.equal((await h(safe)).action,'group-main-menu');
 assert.equal(panels[0][1],'mixed');
 assert.equal((await h(incoming('x','.admin grant me 999'))).ignored,'not-allowed');
 assert.equal((await h(incoming('y','.transfer Test 100'))).ignored,'not-allowed');
 db.close();
});
test('v3.2.2 nonadmin group feedback accepted, but attempting to trigger probe rejected',async()=>{
 const db=openDatabase(':memory:');const outputs=[];
 const h=createWhatsAppHandler({core:createCore(db),allowGroups:true,groupButtonsEnabled:true,
  allowSender:()=>false,sendText:async(j,text)=>outputs.push(text),sendButtons:async()=>({sent:true})});
 assert.equal((await h(incoming('feedback','.groupbuttons report shown'))).action,'group-buttons-feedback');
 assert.equal((await h(incoming('probe','.groupbuttons mixed'))).ignored,'not-allowed');
 db.close();
});
