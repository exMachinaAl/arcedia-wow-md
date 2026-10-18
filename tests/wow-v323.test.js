import test from 'node:test';
import assert from 'node:assert/strict';
import {createWhatsAppHandler} from '../src/wa/handler.js';
import {nativePayload,GROUP_MIXED_ROWS} from '../src/wa/buttons.js';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
const group='123@g.us',member='user@s.whatsapp.net';
const msg=(id,text)=>({key:{remoteJid:group,participant:member,id,fromMe:false},message:{conversation:text}});
test('v3.2.3 common player gets live-tested mixed main menu without privileged commands',async()=>{
 const db=openDatabase(':memory:'),panels=[];
 const handler=createWhatsAppHandler({core:createCore(db),allowGroups:true,allowSender:()=>false,groupButtonsEnabled:false,sendText:async()=>{},sendButtons:async(...args)=>{panels.push(args);return {sent:true}}});
 assert.equal((await handler(msg('one','.menu'))).action,'group-main-menu');
 assert.equal(panels[0][1],'mixed');
 assert.equal((await handler(msg('two','.admin grant me 100'))).ignored,'not-allowed');
 db.close();
});
test('v3.2.3 selector has 12 options while visible quick-replies stay three',()=>{
 const create=x=>x;const IM={create,Header:{create},Body:{create},Footer:{create},NativeFlowMessage:{create}};
 const p=nativePayload({Message:{InteractiveMessage:IM}},{panelName:'groupdemo',mixed:true}).interactiveMessage;
 assert.equal(p.nativeFlowMessage.buttons.filter(x=>x.name==='quick_reply').length,3);
 assert.equal(GROUP_MIXED_ROWS.length,12);
 assert.equal(JSON.parse(p.nativeFlowMessage.buttons.at(-1).buttonParamsJson).sections[0].rows.length,12);
});
