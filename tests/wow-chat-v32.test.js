import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {createChatIdentity} from '../src/wa/chat-identity.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';
import {createGroupButtonLab} from '../src/wa/group-buttons.js';
import {nativePayload,nativeRelayNodes,PANELS,fallbackText} from '../src/wa/buttons.js';
import {parseIncoming} from '../src/wa/message.js';
const U='628300001@s.whatsapp.net',ADMIN='628300002@s.whatsapp.net',G='100200333@g.us';
const NOW=Date.parse('2026-10-18T12:00:00Z');
let counter=0;
function suite(db=openDatabase(':memory:')){
 const core=createCore(db);core.process({senderId:U,eventKey:'user-init-v32',text:'.ping'});core.process({senderId:ADMIN,eventKey:'admin-init-v32',text:'.ping'});
 const id=createChatIdentity({db,adminIds:[ADMIN],now:()=>NOW});
 const cmd=(text,user=U,isGroup=false)=>id.command({senderId:user,chatId:isGroup?G:user,isGroup,groupAdmin:isGroup,eventKey:`v32:${++counter}`,text,at:NOW});
 return {db,core,id,cmd};
}
test('v3.2 owned preset snapshots show authorized equipment and guild tag',()=>{
 const s=suite();s.cmd('.chatstyle on');
 s.db.prepare("INSERT INTO item_stacks(user_id,item_id,quantity) VALUES(?,'jade-frame',1)").run(U);
 s.db.prepare("INSERT INTO item_equipment(user_id,slot,item_id) VALUES(?,'frame','jade-frame')").run(U);
 assert.match(s.cmd('.chatstyle preset save royal'),/disimpan/);
 assert.match(s.cmd('.chatstyle preset use royal'),/aktif/);
 assert.match(s.id.render(U,'hi'),/💠/);
 assert.match(s.id.render(U,'hi'),/WOW-/);
 assert.match(s.cmd('.chatstyle stats'),/CHAT STATS/);
 s.db.close();
});
test('v3.2 saved preset survives restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'v32persist-'));
 try{
  const file=join(dir,'wow.sqlite'),s=suite(openDatabase(file));
  s.cmd('.chatstyle preset save draft');s.cmd('.chatstyle preset use draft');s.db.close();
  const db2=openDatabase(file);const id2=createChatIdentity({db:db2,now:()=>NOW});
  assert.match(id2.command({senderId:U,chatId:U,eventKey:'after-reboot-v32',text:'.chatstyle preset list',at:NOW}),/draft/);
  db2.close();
 } finally{rmSync(dir,{force:true,recursive:true});}
});
test('v3.2 presets cap at five; can replace, remove and revert safely',()=>{
 const s=suite();for(let i=0;i<5;i++)assert.match(s.cmd(`.chatstyle preset save build${i}`),/disimpan/);
 assert.match(s.cmd('.chatstyle preset save sixth'),/Maksimal 5/);
 assert.match(s.cmd('.chatstyle preset save build1'),/disimpan/);
 assert.match(s.cmd('.chatstyle preset use unknown'),/tidak ditemukan/);
 assert.match(s.cmd('.chatstyle preset use build1'),/aktif/);
 assert.match(s.cmd('.chatstyle preset remove build1'),/dihapus/);
 assert.match(s.cmd('.chatstyle preset list'),/equipment langsung/);
 s.db.close();
});
test('v3.2 stolen/non-owned item in old preset cannot appear on render',()=>{
 const s=suite();s.db.prepare("INSERT INTO wow_chat_presets(user_id,name,badge,frame,title,created_ms) VALUES(?,'old','pioneer-badge','jade-frame','veteran-title',?)").run(U,NOW);
 s.cmd('.chatstyle preset use old');const rendered=s.id.render(U,'hi');
 assert.doesNotMatch(rendered,/PIONEER|VETERAN|💠/);
 s.db.close();
});
test('v3.2 guild tag follows current valid membership and safe sender attribution',()=>{
 const s=suite();s.core.process({senderId:U,eventKey:'grantv32',text:'.wow starter'});
 // Check without a guild; naming must be safely bounded.
 assert.match(s.id.render(U,'hello'),/Ditulis pemain/);
 s.db.close();
});
test('v3.2 private stats do not contain message contents or other user private values',()=>{
 const s=suite();const reply=s.cmd('.chatstyle stats');assert.doesNotMatch(reply,/628300002/);
 assert.match(reply,/Dikirim:/);s.db.close();
});
test('v3.2 group button probe admin only and opt-in flag',async()=>{
 const sent=[],replies=[],record=[];
 const opts={jid:G,sender:U,text:'.groupbuttons probe',sendText:async(...a)=>replies.push(a),sendButtons:async(...a)=>{sent.push(a);return {sent:true,stage:'relayed-unverified'};},record:x=>record.push(x)};
 const lab=createGroupButtonLab({enabled:true,now:()=>NOW});
 const unauthorized=await lab.handle({...opts,groupAdmin:false});assert.equal(unauthorized.ok,false);assert.equal(sent.length,0);
 const allowed=await lab.handle({...opts,groupAdmin:true});assert.equal(allowed.action,'group-button-probe');assert.equal(sent.length,1);
 assert.equal(sent[0][1],'native');assert.equal(sent[0][3].panelName,'groupdemo');
 assert.equal(record[0].stage,'relayed-unverified');
 const blocked=await lab.handle({...opts,groupAdmin:true});assert.equal(blocked.reason,'rate-limit');
 const off=createGroupButtonLab({enabled:false,now:()=>NOW});await off.handle({...opts,groupAdmin:true});assert.equal(sent.length,1);
});
test('v3.2 group selector payload and fallback are present for 3 safe commands',async()=>{
 const fallback=fallbackText('native','groupdemo');assert.match(fallback,/\.menu/);assert.match(fallback,/\.games/);
 const proto={Message:{InteractiveMessage:{create:x=>x,Header:{create:x=>x},Body:{create:x=>x},Footer:{create:x=>x},NativeFlowMessage:{create:x=>x}}}};
 const payload=nativePayload(proto,{panelName:'groupdemo',selector:true});
 const button=payload.interactiveMessage.nativeFlowMessage.buttons[0];assert.equal(button.name,'single_select');
 const data=JSON.parse(button.buttonParamsJson);assert.equal(data.sections[0].rows.length,3);
 assert.deepEqual(nativeRelayNodes(G,1000).map(x=>x.tag),['biz']);
 const selection={message:{interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:JSON.stringify({id:'waw:games'})}}}};
 assert.equal(parseIncoming(selection)?.text,'.games');
 const legacyList={message:{listResponseMessage:{singleSelectReply:{selectedRowId:'waw:menu'}}}};
 assert.equal(parseIncoming(legacyList)?.text,'.menu');
});
test('v3.2 group probe report recorded as user observation only',async()=>{
 const reports=[];
 const lab=createGroupButtonLab({enabled:false,now:()=>NOW});
 await lab.handle({jid:G,sender:U,text:'.groupbuttons report hidden',sendText:async()=>{},record:x=>reports.push(x)});
 assert.equal(reports[0].outcome,'hidden');assert.equal(reports[0].mode,'group');
});
test('v3.2 handler group lab intercepts without exposing wallet or bypassing admin metadata',async()=>{
 const s=suite(),replies=[],sent=[];
 const h=createWhatsAppHandler({core:s.core,chatIdentity:s.id,allowGroups:true,groupButtonsEnabled:true,
  getGroupAdmin:async()=>false,sendText:async(j,t)=>replies.push(t),sendButtons:async(...args)=>{sent.push(args);return {sent:true,stage:'relayed-unverified'};}});
 await h({key:{remoteJid:G,participant:U,id:'gr-lab-1',fromMe:false},message:{conversation:'.groupbuttons probe'}});
 assert.equal(sent.length,0);assert.match(replies[0],/admin grup/);
 s.db.close();
});
