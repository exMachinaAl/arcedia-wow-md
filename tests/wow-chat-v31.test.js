import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {createChatIdentity} from '../src/wa/chat-identity.js';
const START=Date.parse('2026-10-18T11:00:00Z');
const G='120363012345@g.us',USER='62810002@s.whatsapp.net',ADMIN='62819999@s.whatsapp.net';
const message=(id='m1',sender=USER,body='Hello WOW')=>({key:{remoteJid:G,participant:sender,id,fromMe:false},message:{conversation:body}});
function suite(db=openDatabase(':memory:')){
 let time=START,seq=0;
 const core=createCore(db);core.process({senderId:USER,eventKey:'p1',text:'.ping'});
 const id=createChatIdentity({db,adminIds:[ADMIN],now:()=>time});
 const cmd=(actor,txt,group=false,isAdmin=true)=>id.command({senderId:actor,chatId:group?G:actor,isGroup:group,groupAdmin:isAdmin,eventKey:`v31:${++seq}`,text:txt,at:time});
 const advance=n=>{time+=n;return time};
 const setup=()=>{
  cmd(ADMIN,'.admin chat global on');cmd(USER,'.chatstyle on');cmd(ADMIN,'.wowchat enable',true);
  cmd(ADMIN,'.admin chat replace on');cmd(ADMIN,'.wowchat mode replace',true);
  cmd(ADMIN,'.wowchat delete on',true);cmd(USER,'.chatstyle replace on');
 };
 return {db,id,cmd,setup,advance,now:()=>time};
}
function sent(s,msgId='mirror1'){
 const a=s.id.ingest(message(msgId),s.now());assert.equal(a.accepted,true,a.reason);
 const j=s.id.claim(s.now());assert.ok(j);assert.equal(j.source_id,msgId);
 assert.equal(s.id.finish(j.source_key,true,`bot-${msgId}`,s.now()),1);
 return {job:j,key:{remoteJid:G,id:`bot-${msgId}`,fromMe:true}};
}
test('v3.1 Replace fail-closed until server, group and player consent',()=>{
 const s=suite();s.cmd(ADMIN,'.admin chat global on');s.cmd(USER,'.chatstyle on');s.cmd(ADMIN,'.wowchat enable',true);
 assert.match(s.cmd(ADMIN,'.wowchat mode replace',true),/belum mengizinkan/);
 s.cmd(ADMIN,'.admin chat replace on');s.cmd(ADMIN,'.wowchat mode replace',true);
 assert.equal(s.id.ingest(message(),s.now()).accepted,true);
 s.cmd(ADMIN,'.wowchat delete on',true);s.advance(6000);assert.equal(s.id.ingest(message('no-delete-2'),s.now()).accepted,true);
 s.cmd(USER,'.chatstyle replace on');s.advance(6000);assert.equal(s.id.ingest(message('allowed-3'),s.now()).accepted,true);s.db.close();
});
test('v3.1 mirror mode never changes into deleting retroactively',()=>{
 const s=suite();s.cmd(ADMIN,'.admin chat global on');s.cmd(USER,'.chatstyle on');s.cmd(ADMIN,'.wowchat enable',true);s.cmd(ADMIN,'.wowchat mode mirror',true);
 const a=s.id.ingest(message(),s.now());assert.ok(a.accepted);
 s.cmd(ADMIN,'.admin chat replace on');s.cmd(ADMIN,'.wowchat mode replace',true);s.cmd(ADMIN,'.wowchat delete on',true);s.cmd(USER,'.chatstyle replace on');
 const old=s.id.claim(s.now()); assert.equal(old.delete_state,'NONE'); // never retroactively eligible for revoke
 assert.equal(old.source_id,null);s.db.close();
});
test('v3.1 delivery ACK required; server ACK and unrelated key cannot delete',()=>{
 const s=suite();s.setup();const {job,key}=sent(s);
 assert.equal(s.id.claimDelete(s.now()),null);
 assert.equal(s.id.ackDelivered(key,2,s.now()),0);
 assert.equal(s.id.ackDelivered({...key,id:'other'},3,s.now()),0);
 assert.equal(s.id.ackDelivered({...key,fromMe:false},3,s.now()),0);
 assert.equal(s.id.claimDelete(s.now()),null);
 assert.equal(s.id.ackDelivered(key,3,s.now()),1);
 const del=s.id.claimDelete(s.now());assert.equal(del.source_key,job.source_key);
 assert.deepEqual(del.key,{remoteJid:G,participant:USER,id:'mirror1',fromMe:false});s.db.close();
});
test('v3.1 delete request idempotent, with status REQUESTED not client-proven',()=>{
 const s=suite();s.setup();const {job,key}=sent(s);assert.equal(s.id.ackDelivered(key,3,s.now()),1);
 const del=s.id.claimDelete(s.now());assert.ok(del);
 assert.equal(s.id.claimDelete(s.now()),null);
 assert.equal(s.id.finishDelete(job.source_key,true),1);
 assert.equal(s.db.prepare('SELECT delete_state FROM wow_chat_queue WHERE source_key=?').get(job.source_key).delete_state,'DELETE_REQUESTED');
 assert.equal(s.id.finishDelete(job.source_key,true),0);s.db.close();
});
test('v3.1 delete failure preserves request failure audit and original',()=>{
 const s=suite();s.setup();const {job,key}=sent(s);s.id.ackDelivered(key,3,s.now());s.id.claimDelete(s.now());
 s.id.finishDelete(job.source_key,false,'not-admin');
 const row=s.db.prepare('SELECT delete_state,reason FROM wow_chat_queue WHERE source_key=?').get(job.source_key);
 assert.equal(row.delete_state,'FAILED_DELETE');assert.equal(row.reason,'not-admin');s.db.close();
});
test('v3.1 revoking permissions after ACK prevents any deletion',()=>{
 const s=suite();s.setup();const {job,key}=sent(s);s.id.ackDelivered(key,3,s.now());
 s.cmd(USER,'.chatstyle replace off');assert.equal(s.id.claimDelete(s.now()),null);
 assert.equal(s.db.prepare('SELECT delete_state FROM wow_chat_queue WHERE source_key=?').get(job.source_key).delete_state,'SKIPPED');s.db.close();
});
test('v3.1 group admin disable and server global kill skip scheduled deletion',()=>{
 const s=suite();s.setup();const {key}=sent(s);s.id.ackDelivered(key,3,s.now());s.cmd(ADMIN,'.wowchat delete off',true);
 assert.equal(s.id.claimDelete(s.now()),null);s.advance(6500);
 s.cmd(ADMIN,'.wowchat delete on',true);
 const {key:key2}=sent(s,'m2');s.id.ackDelivered(key2,3,s.now());s.cmd(ADMIN,'.admin chat global off');
 assert.equal(s.id.claimDelete(s.now()),null);s.db.close();
});
test('v3.1 no ACK within window safely expires without delete',()=>{
 const s=suite();s.setup();const {key}=sent(s);s.advance(21000);
 assert.equal(s.id.ackDelivered(key,3,s.now()),0);assert.equal(s.id.claimDelete(s.now()),null);
 assert.equal(s.db.prepare('SELECT delete_state FROM wow_chat_queue').get().delete_state,'SKIPPED');s.db.close();
});
test('v3.1 sending failed or sendMessage returned no key never triggers delete',()=>{
 const s=suite();s.setup();const a=s.id.ingest(message(),s.now());const j=s.id.claim(s.now());s.id.finish(j.source_key,false,'timeout',s.now());
 assert.equal(s.id.claimDelete(s.now()),null);assert.equal(s.db.prepare('SELECT delete_state FROM wow_chat_queue').get().delete_state,'SKIPPED');
 s.advance(7000);const b=s.id.ingest(message('m2'),s.now());const k=s.id.claim(s.now());assert.ok(b.accepted);s.id.finish(k.source_key,true,'',s.now());
 assert.equal(s.db.prepare('SELECT delete_state FROM wow_chat_queue WHERE source_key=?').get(k.source_key).delete_state,'SKIPPED');s.db.close();
});
test('v3.1 after restart pending sends remain ambiguous; no delayed deletion',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wow-replace-'));
 try{
  const file=join(dir,'world.sqlite');let s=suite(openDatabase(file));s.setup();const {job,key}=sent(s);s.id.ackDelivered(key,3,s.now());s.db.close();
  const db=openDatabase(file),reopened=createChatIdentity({db,adminIds:[ADMIN],now:()=>START+2000});
  assert.equal(reopened.recover(),0);assert.equal(reopened.claimDelete(START+2000),null);
  assert.equal(db.prepare('SELECT delete_state FROM wow_chat_queue WHERE source_key=?').get(job.source_key).delete_state,'AMBIGUOUS');db.close();
 }finally{rmSync(dir,{force:true,recursive:true});}
});
test('v3.1 v3.0 on-disk group policy migrates safely with existing rows',()=>{
 const db=openDatabase(':memory:');createCore(db);
 db.exec("DROP TABLE IF EXISTS wow_chat_groups");
 db.exec("CREATE TABLE wow_chat_groups(group_id TEXT PRIMARY KEY,enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),mode TEXT NOT NULL DEFAULT 'identity' CHECK(mode IN ('identity','mirror')),updated_ms INTEGER NOT NULL);");
 db.prepare("INSERT INTO wow_chat_groups VALUES(?,?,?,?)").run(G,1,'mirror',START);
 createChatIdentity({db});
 const row=db.prepare('SELECT enabled,mode,delete_enabled FROM wow_chat_groups WHERE group_id=?').get(G);
 assert.deepEqual({...row},{enabled:1,mode:'mirror',delete_enabled:0});
 assert.doesNotThrow(()=>db.prepare("UPDATE wow_chat_groups SET mode='replace' WHERE group_id=?").run(G));db.close();
});
test('v3.1 missing verified admin group metadata fails closed at dispatch API',()=>{
 const s=suite();s.setup();const {job,key}=sent(s);s.id.ackDelivered(key,3,s.now());
 const del=s.id.claimDelete(s.now());assert.equal(del.source_key,job.source_key);
 assert.equal(s.id.skipDelete(job.source_key,'bot-not-verified-admin'),1);
 assert.equal(s.db.prepare('SELECT delete_state FROM wow_chat_queue WHERE source_key=?').get(job.source_key).delete_state,'SKIPPED');s.db.close();
});

test('v3.1 consent revoked after job claim blocks late revoke dispatch',()=>{
 const s=suite();s.setup();const {job,key}=sent(s);s.id.ackDelivered(key,3,s.now());
 const d=s.id.claimDelete(s.now());assert.ok(d);assert.equal(s.id.stillAllowedDelete(job.source_key,s.now()),true);
 s.cmd(USER,'.chatstyle replace off');assert.equal(s.id.stillAllowedDelete(job.source_key,s.now()),false);
 assert.equal(s.id.skipDelete(job.source_key,'policy-revoked-after-check'),1);s.db.close();
});
