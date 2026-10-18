import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {createChatIdentity} from '../src/wa/chat-identity.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';
const G='123456@g.us',A='6281000001@s.whatsapp.net',LID='123456789@lid',ADMIN='6281999999@s.whatsapp.net';
const msg=(id,text,sender=A,alt=undefined,jid=G)=>({key:{remoteJid:jid,participant:sender,participantAlt:alt,id,fromMe:false},message:{conversation:text}});
function setup(){
 const db=openDatabase(':memory:');const core=createCore(db);const ci=createChatIdentity({db,adminIds:[ADMIN],now:()=>Date.parse('2026-10-18T12:00:00Z')});let i=0;
 const command=(actor,text,group=false)=>ci.command({senderId:actor,chatId:group?G:actor,isGroup:group,groupAdmin:group,eventKey:`x-${++i}`,text});
 command(ADMIN,'.admin chat global on');command(ADMIN,'.wowchat enable',true);command(ADMIN,'.wowchat mode mirror',true);
 return {db,core,ci,command};
}
test('v3.2.1 common player with admin-only WA allowlist may opt-in by DM',async()=>{
 const e=setup();const outputs=[];
 const h=createWhatsAppHandler({core:e.core,chatIdentity:e.ci,allowGroups:true,allowSender:(sender,jid)=>sender===ADMIN,sendText:async(j,t)=>outputs.push(t),sendButtons:async()=>({sent:false})});
 await h(msg('dmstyle','.chatstyle on',undefined,undefined,A));
 assert.match(outputs[0],/ON/);
 assert.equal((await h(msg('groupchat','I am a regular member'))).accepted,true);
 assert.match(e.ci.claim(Date.parse('2026-10-18T12:00:00Z')).text,/EXPLORER/);
 e.db.close();
});
test('v3.2.1 ordinary gameplay commands remain restricted by allowlist',async()=>{
 const e=setup();const h=createWhatsAppHandler({core:e.core,chatIdentity:e.ci,allowGroups:true,allowSender:()=>false,sendText:async()=>{},sendButtons:async()=>({sent:false})});
 assert.equal((await h(msg('wallet','.wallet'))).ignored,'not-allowed');
 assert.equal((await h(msg('whoami','.whoami',undefined,undefined,A))).ignored,'not-allowed');
 e.db.close();
});
test('v3.2.1 LID in group resolves opted-in phone identity and retains original mention',()=>{
 const e=setup();e.command(A,'.chatstyle on');
 const r=e.ci.ingest(msg('lidmatch','Hey group',LID,A),Date.parse('2026-10-18T12:00:00Z'));
 assert.equal(r.accepted,true);const job=e.ci.claim(Date.parse('2026-10-18T12:00:00Z'));
 assert.deepEqual(job.mentions,[LID]);assert.match(job.text,/EXPLORER/);
 assert.equal(e.db.prepare('SELECT sender_id,source_sender_id FROM wow_chat_queue').get().sender_id,A);
 assert.equal(e.db.prepare('SELECT source_sender_id FROM wow_chat_queue').get().source_sender_id,LID);
 e.db.close();
});
test('v3.2.1 no equipment needed but explicit opt-in required',()=>{
 const e=setup();let r=e.ci.ingest(msg('no1','Hello'),Date.parse('2026-10-18T12:00:00Z'));assert.equal(r.reason,'no-consent');
 e.command(A,'.chatstyle on');r=e.ci.ingest(msg('yes1','Hello'),Date.parse('2026-10-18T12:00:00Z'));assert.equal(r.accepted,true);
 const j=e.ci.claim(Date.parse('2026-10-18T12:00:00Z'));assert.match(j.text,/EXPLORER/);
 assert.doesNotMatch(j.text,/PIONEER/);e.db.close();
});
test('v3.2.1 group diagnostics counts skipped reasons without saving chat text',()=>{
 const e=setup();e.ci.ingest(msg('n','Cannot decorate this'),Date.parse('2026-10-18T12:00:00Z'));
 const d=e.command(ADMIN,'.wowchat diagnose',true);
 assert.match(d,/no-consent: 1/);assert.doesNotMatch(d,/Cannot decorate/);
 assert.equal(e.db.prepare('SELECT SUM(count) AS n FROM wow_chat_diagnostics').get().n,1);e.db.close();
});
test('v3.2.1 LID mention block cannot be bypassed using phone identity',()=>{
 const e=setup();e.command(A,'.chatstyle on');
 e.ci.command({senderId:ADMIN,chatId:G,isGroup:true,groupAdmin:true,mentionedJids:[LID],eventKey:'block',text:'.wowchat block @User'});
 assert.equal(e.ci.ingest(msg('blocked','blocked text',LID,A),Date.parse('2026-10-18T12:00:00Z')).reason,'blocked');e.db.close();
});
test('v3.2.1 no automatic deletion in mirror even when using LID',()=>{
 const e=setup();e.command(A,'.chatstyle on');const at=Date.parse('2026-10-18T12:00:00Z');
 e.ci.ingest(msg('mirror','Text',LID,A),at);const j=e.ci.claim(at);
 e.ci.finish(j.source_key,true,'reply-message',at);
 assert.equal(e.ci.ackDelivered({remoteJid:G,fromMe:true,id:'reply-message'},3,at),0);
 assert.equal(e.ci.claimDelete(at),null);e.db.close();
});

test('v3.2.1 restricted group that did not opt in never bypasses command allowlist',async()=>{
 const db=openDatabase(':memory:');const core=createCore(db),ci=createChatIdentity({db,adminIds:[ADMIN]});
 const h=createWhatsAppHandler({core,chatIdentity:ci,allowGroups:true,allowSender:()=>false,sendText:async()=>{},sendButtons:async()=>({sent:false})});
 assert.equal((await h(msg('private','Do not intercept'))).ignored,'not-allowed');
 assert.equal(ci.stats().PENDING??0,0);db.close();
});
