import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {createChatIdentity,plainGroupText} from '../src/wa/chat-identity.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';
const BASE=Date.parse('2026-10-18T12:00:00Z');
const G='1202003@g.us',A='62810001@s.whatsapp.net',B='62810002@s.whatsapp.net',ADMIN='62819999@s.whatsapp.net';
const incoming=(from=A,id='x1',text='Halo semua!',jid=G)=>({key:{remoteJid:jid,participant:from,id,fromMe:false},message:{conversation:text}});
function setup(db=openDatabase(':memory:')){
 let t=BASE,n=0;
 const core=createCore(db);
 core.process({senderId:A,eventKey:'initialize-a',text:'.ping'});
 core.process({senderId:B,eventKey:'initialize-b',text:'.ping'});
 const system=createChatIdentity({db,adminIds:[ADMIN],now:()=>t});
 const cmd=(from,text,{group=false,admin=false,mentions=[]}={})=>system.command({senderId:from,chatId:group?G:from,eventKey:`stage1:${++n}`,isGroup:group,groupAdmin:admin,mentionedJids:mentions,text,at:t});
 const tick=(ms=2000)=>{t+=ms;return t;};
 return {db,core,system,cmd,tick,time:()=>t};
}
function prepare(e){
 assert.match(e.cmd(ADMIN,'.admin chat global on'),/ON/);
 assert.match(e.cmd(A,'.chatstyle on'),/ON/);
 assert.match(e.cmd(ADMIN,'.wowchat enable',{group:true,admin:true}),/ON/);
 assert.match(e.cmd(ADMIN,'.wowchat mode mirror',{group:true,admin:true}),/mirror/);
}
test('v3 chat global / group / player require explicit consent',()=>{
 const e=setup();assert.equal(e.system.ingest(incoming(),e.time()).reason,'disabled');
 assert.match(e.cmd(A,'.admin chat global on'),/Hanya admin/);
 assert.match(e.cmd(ADMIN,'.admin chat global on'),/ON/);
 assert.match(e.cmd(A,'.wowchat enable',{group:true}),/Hanya admin/);
 assert.match(e.cmd(ADMIN,'.wowchat enable',{group:true,admin:true}),/ON/);
 assert.match(e.cmd(ADMIN,'.wowchat mode mirror',{group:true,admin:true}),/mirror/);
 assert.equal(e.system.ingest(incoming(),e.time()).reason,'no-consent');
 assert.match(e.cmd(A,'.chatstyle on'),/ON/);
 assert.equal(e.system.ingest(incoming(),e.time()).accepted,true);
 e.db.close();
});
test('v3 chat rejects unsafe or command input, and never mirror outgoing',()=>{
 const e=setup();prepare(e);
 assert.equal(e.system.ingest(incoming(A,'cmd','.wallet'),e.time()).reason,'not-plain-text');
 assert.equal(e.system.ingest(incoming(A,'big','a'.repeat(281)),e.time()).reason,'not-plain-text');
 const m=incoming(A,'out');m.key.fromMe=true;
 assert.equal(e.system.ingest(m,e.time()).reason,'not-group-input');
 assert.equal(plainGroupText({message:{imageMessage:{caption:'hi'}}}),null);
 e.db.close();
});
test('v3 chat render authentic nickname, bounded ID, equipment and attribution',()=>{
 const e=setup();prepare(e);
 e.db.prepare("UPDATE player_stats SET nickname='Alpha' WHERE user_id=?").run(A);
 e.db.prepare("INSERT INTO item_stacks(user_id,item_id,quantity) VALUES(?,'pioneer-badge',1)").run(A);
 e.db.prepare("INSERT INTO item_equipment(user_id,slot,item_id) VALUES(?,'badge','pioneer-badge')").run(A);
 const j=e.system.ingest(incoming(A,'a1','Main catur'),e.time());
 assert.ok(j.accepted);
 const c=e.system.claim(e.time());
 assert.match(c.text,/Alpha/);assert.match(c.text,/PIONEER/);assert.match(c.text,/Main catur/);assert.match(c.text,/WOW Bot/);
 assert.deepEqual(c.mentions,[A]);assert.equal(e.system.finish(j.sourceKey,true,'server-msg',e.time()),1);
 assert.equal(e.db.prepare('SELECT body FROM wow_chat_queue WHERE source_key=?').get(j.sourceKey).body,null);
 e.db.close();
});
test('v3 chat replay dedupe and per-player rate limiting prevent spam',()=>{
 const e=setup();prepare(e);
 assert.equal(e.system.ingest(incoming(A,'one'),e.time()).accepted,true);
 assert.equal(e.system.ingest(incoming(A,'one'),e.time()).reason,'duplicate');
 assert.equal(e.system.ingest(incoming(A,'two'),e.time()).reason,'player-rate');
 e.tick(6000);
 assert.equal(e.system.ingest(incoming(A,'three'),e.time()).accepted,true);
 e.db.close();
});
test('v3 chat group admin block and player opt-out stop queued messages',()=>{
 const e=setup();prepare(e);
 assert.equal(e.system.ingest(incoming(A,'one'),e.time()).accepted,true);
 assert.match(e.cmd(ADMIN,'.wowchat block @Alpha',{group:true,admin:true,mentions:[A]}),/dinonaktifkan/);
 assert.equal(e.system.claim(e.time()),null);
 assert.equal(e.system.stats().SKIPPED,1);
 assert.equal(e.system.ingest(incoming(A,'two'),e.time()).reason,'blocked');
 assert.match(e.cmd(ADMIN,'.wowchat unblock @Alpha',{group:true,admin:true,mentions:[A]}),/diizinkan/);
 e.tick(6500);
 assert.equal(e.system.ingest(incoming(A,'three'),e.time()).accepted,true);
 assert.match(e.cmd(A,'.chatstyle off'),/OFF/);
 assert.equal(e.system.claim(e.time()),null);
 e.db.close();
});
test('v3 chat queue persists across restart; ambiguous sends not automatically retried',()=>{
 const folder=mkdtempSync(join(tmpdir(),'wowchat-'));
 try{
  const file=join(folder,'world.sqlite');const e=setup(openDatabase(file));prepare(e);
  assert.equal(e.system.ingest(incoming(A,'one'),e.time()).accepted,true);
  const e2=e.system.claim(e.time());assert.ok(e2);
  e.db.close();
  const db2=openDatabase(file);const sys2=createChatIdentity({db:db2,adminIds:[ADMIN],now:()=>BASE+1000});
  assert.equal(sys2.recover(),1);assert.equal(sys2.claim(BASE+1000),null);
  const r=db2.prepare("SELECT status,body FROM wow_chat_queue WHERE source_key=?").get(e2.source_key);
  assert.equal(r.status,'AMBIGUOUS');assert.equal(r.body,null);db2.close();
 }finally{rmSync(folder,{recursive:true,force:true});}
});
test('v3 chat expires stale queue rather than mirroring old messages',()=>{
 const e=setup();prepare(e);
 assert.equal(e.system.ingest(incoming(A,'one'),e.time()).accepted,true);
 e.tick(48000);assert.equal(e.system.claim(e.time()),null);assert.equal(e.system.stats().SKIPPED,1);
 e.db.close();
});
test('v3 chat group identity mode never emits automatic mirror',()=>{
 const e=setup();prepare(e);
 e.cmd(ADMIN,'.wowchat mode identity',{group:true,admin:true});
 assert.equal(e.system.ingest(incoming(A,'plain'),e.time()).reason,'disabled');
 assert.match(e.cmd(A,'.chatstyle preview'),/WOW IDENTITY/);e.db.close();
});
test('v3 chat command replay is idempotent and group admin checked by handler',async()=>{
 const e=setup();prepare(e);const sent=[];
 const handler=createWhatsAppHandler({core:e.core,chatIdentity:e.system,allowGroups:true,
  getGroupAdmin:async()=>false,sendText:async(j,t)=>{sent.push(t);},sendButtons:async()=>({sent:false})});
 const message=incoming(A,'group-admin','.wowchat disable');
 await handler(message);assert.match(sent.at(-1),/Hanya admin/);
 const normal=incoming(A,'normal','Hello world');await handler(normal);
 assert.equal(e.system.stats().PENDING,1);
 e.db.close();
});
test('v3 chat admin can kill server flag immediately and suppress pending',()=>{
 const e=setup();prepare(e);
 assert.equal(e.system.ingest(incoming(A,'one'),e.time()).accepted,true);
 e.cmd(ADMIN,'.admin chat global off');assert.equal(e.system.claim(e.time()),null);
 assert.equal(e.system.stats().SKIPPED,1);e.db.close();
});
test('v3 chat replace disabled unless global server permission granted',()=>{
 const e=setup();prepare(e);assert.match(e.cmd(ADMIN,'.wowchat mode replace',{group:true,admin:true}),/belum mengizinkan Replace/i);
 assert.equal(e.system.claim(e.time()),null);e.db.close();
});
test('v3 chat queue enforces per-group backpressure before flooding',()=>{
 const e=setup();prepare(e);
 for(let i=0;i<30;i++){
  const id=`628102${String(i).padStart(5,'0')}@s.whatsapp.net`;
  e.core.process({senderId:id,eventKey:'u:'+i,text:'.ping'});
  e.cmd(id,'.chatstyle on');
  assert.equal(e.system.ingest(incoming(id,'msg-'+i),e.time()).accepted,true);
 }
 const other='628177777@s.whatsapp.net';e.core.process({senderId:other,eventKey:'u:over',text:'.ping'});e.cmd(other,'.chatstyle on');
 assert.equal(e.system.ingest(incoming(other,'overflow'),e.time()).reason,'backpressure');
 assert.equal(e.system.stats().PENDING,30);e.db.close();
});
test('v3 chat send failure scrubs payload and never deletes originals',()=>{
 const e=setup();prepare(e);
 const result=e.system.ingest(incoming(A,'send-fail','Oops'),e.time());
 assert.equal(result.accepted,true);
 assert.ok(e.system.claim(e.time()));
 assert.equal(e.system.finish(result.sourceKey,false,'server-unavailable',e.time()),1);
 assert.equal(e.system.stats().FAILED,1);
 const row=e.db.prepare('SELECT body FROM wow_chat_queue WHERE source_key=?').get(result.sourceKey);
 assert.equal(row.body,null);e.db.close();
});
