import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';
const T=Date.parse('2026-10-17T10:00:00Z');
function setup(){
  const db=openDatabase(':memory:'),core=createCore(db,{randomInt:min=>min});let n=0;
  const run=(user,command,time=T,key=`social:${++n}`)=>core.process({senderId:user,eventKey:key,text:command,now:time});
  const init=()=>{run('a','.nick Alpha');run('b','.nick Beta');run('c','.nick Gamma');};
  const friends=()=>{init();run('a','.friend add Beta');run('b','.friend accept Alpha');};
  return {db,core,run,init,friends};
}
test('Friend request requires named account, consent and remains private',()=>{
 const {db,run,init}=setup();init();
 assert.match(run('a','.friend add Beta'),/tersimpan/);
 assert.match(run('b','.friend inbox'),/Alpha/);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM friendships').get().n,0);
 assert.match(run('b','.friend accept Alpha'),/berteman/);
 assert.match(run('a','.friend list'),/Beta/);
 assert.match(run('a','.friend add Beta'),/sudah berteman/);
 assert.doesNotMatch(run('a','.friend list'),/@s.whatsapp.net/);db.close();
});
test('Friend cannot self add, cannot accept arbitrary request, cannot spoof nickname case',()=>{
 const {db,run,init}=setup();init();
 assert.match(run('a','.friend add Alpha'),/akun sendiri/);
 assert.match(run('b','.friend accept Alpha'),/Tidak ada permintaan/);
 assert.match(run('c','.nick alpha'),/sudah digunakan/);
 assert.match(run('a','.friend add beta'),/tersimpan/);db.close();
});
test('Friend request expiration, refusal, and block controls',()=>{
 const {db,run,init}=setup();init();
 assert.match(run('a','.friend add Beta'),/tersimpan/);
 assert.match(run('b','.friend decline Alpha'),/ditolak/);
 assert.match(run('b','.friend accept Alpha'),/Tidak ada/);
 run('a','.friend add Beta',T+86400000);
 assert.match(run('b','.friend accept Alpha',T+8*86400000),/Tidak ada/);
 run('a','.friend add Beta',T+8*86400000);run('b','.friend accept Alpha',T+8*86400000);
 assert.match(run('b','.friend block Alpha'),/diblokir/);
 assert.match(run('a','.friend list'),/Kosong/);
 assert.match(run('a','.friend add Beta'),/blokir/);
 assert.match(run('b','.friend unblock Alpha'),/dibuka/);db.close();
});
test('v1.9 transfers are permanently forbidden even for mutual friends',()=>{
 const {db,run,friends}=setup();friends();run('a','.daily');
 for(const cmd of ['.pay Beta 5','.pay enable','.pay status','.pay disable'])assert.match(run('a',cmd),/DILARANG/);
 assert.equal(db.prepare('SELECT SUM(balance) AS total FROM wallets').get().total,10);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transfers').get().n,0);db.close();
});
test('v1.9 replaying a forbidden transfer does not change balance or add events',()=>{
 const {db,run,friends}=setup();friends();run('a','.daily');
 const a=run('a','.pay Beta 5',T,'transfer:one');assert.equal(run('a','.pay Beta 5',T,'transfer:one'),a);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transfer_entries').get().n,0);
 assert.equal(db.prepare("SELECT balance FROM wallets WHERE user_id='a'").get().balance,10);db.close();
});
test('v1.9 transfer forbidden regardless of amount or input',()=>{
 const {db,run,friends}=setup();friends();
 for(const amount of ['-1','0','1','1.5','50','10000'])assert.match(run('a',`.pay Beta ${amount}`),/DILARANG/);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transfers').get().n,0);db.close();
});
test('v1.9 database blocks bypass of transfer prohibition',()=>{
 const {db,run}=setup();run('a','.daily');run('b','.menu');
 assert.throws(()=>db.prepare("INSERT INTO transfers(id,sender_id,receiver_id,amount,day,created_at) VALUES('z','a','b',5,'2026-10-18',0)").run(),/transfers permanently disabled/);
 assert.throws(()=>db.prepare("INSERT INTO social_settings(user_id,transfer_enabled) VALUES('a',1)").run(),/V transfers permanently disabled|CHECK/);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transfers').get().n,0);db.close();
});
test('Duels require friendship; no wager, hidden choices, strict ownership',()=>{
 const {db,run,friends}=setup();friends();
 assert.match(run('a','.duel invite Gamma'),/tidak ditemukan|teman/);
 const invited=run('a','.duel invite Beta');
 const id=invited.match(/[a-f0-9-]{36}/)?.[0];assert.ok(id);
 assert.match(run('c',`.duel accept ${id}`),/tidak ditemukan/);
 assert.match(run('b','.duel inbox'),new RegExp(id));
 assert.match(run('b',`.duel accept ${id}`),/aktif/);
 assert.match(run('a',`.duel pick ${id} batu`),/rahasia/);
 assert.match(run('a',`.duel pick ${id} gunting`),/sudah memilih/);
 assert.match(run('b',`.duel status ${id}`),/belum dipilih/);
 assert.match(run('b',`.duel pick ${id} gunting`),/Alpha menang/);
 assert.equal(db.prepare('SELECT winner_id FROM duels WHERE id=?').get(id).winner_id,'a');
 assert.equal(db.prepare('SELECT count(*) AS n FROM transfers').get().n,0);
 assert.match(run('a',`.duel pick ${id} batu`),/belum aktif\/selesai/);db.close();
});
test('Duel draws, expiration and cancel',()=>{
 const {db,run,friends}=setup();friends();
 let id=run('a','.duel invite Beta').match(/[a-f0-9-]{36}/)[0];
 assert.match(run('b',`.duel accept ${id}`,T+10*60000),/kedaluwarsa/);
 id=run('a','.duel invite Beta',T+11*60000).match(/[a-f0-9-]{36}/)[0];
 run('b',`.duel accept ${id}`,T+11*60000);run('a',`.duel pick ${id} batu`,T+11*60000);
 assert.match(run('b',`.duel pick ${id} batu`,T+11*60000),/SERI/);
 assert.equal(db.prepare('SELECT winner_id FROM duels WHERE id=?').get(id).winner_id,null);
 id=run('a','.duel invite Beta',T+12*60000).match(/[a-f0-9-]{36}/)[0];
 assert.match(run('a',`.duel cancel ${id}`,T+12*60000),/dibatalkan/);db.close();
});
test('Duel same message event cannot create two invitations',()=>{
 const {db,run,friends}=setup();friends();
 const x=run('a','.duel invite Beta',T,'one-invite');const y=run('a','.duel invite Beta',T,'one-invite');
 assert.equal(x,y);assert.equal(db.prepare('SELECT count(*) AS n FROM duels').get().n,1);db.close();
});
test('Social commands use static WhatsApp button allowlist',async()=>{
 const {PANELS,BUTTON_COMMANDS}=await import('../src/wa/buttons.js');
 assert.ok(PANELS.social&&PANELS.friends&&PANELS.duels&&PANELS.transfers);
 assert.equal(BUTTON_COMMANDS['waw:social:friends'],'.friend');
 const {db,core}=setup();const panels=[];const handle=createWhatsAppHandler({core,sendText:async()=>{},sendButtons:async(_j,_mode,_msg,opts)=>{panels.push(opts?.panelName);return {sent:true,stage:'relayed-unverified'};}});
 await handle({key:{remoteJid:'a@s.whatsapp.net',fromMe:false,id:'abc'},message:{conversation:'.social'}});
 assert.deepEqual(panels,['social']);db.close();
});
test('Friend request declined cannot be replayed immediately, uses 24h cooldown',()=>{
 const {db,run,init}=setup();init();run('a','.friend add Beta');run('b','.friend decline Alpha');
 assert.match(run('a','.friend add Beta'),/24 jam/);
 assert.match(run('a','.friend add Beta',T+86400001),/tersimpan/);db.close();
});
test('Duel turns cannot continue after friend block',()=>{
 const {db,run,friends}=setup();friends();const id=run('a','.duel invite Beta').match(/[a-f0-9-]{36}/)[0];
 run('b',`.duel accept ${id}`);run('b','.friend block Alpha');
 assert.match(run('a',`.duel pick ${id} batu`),/ditangguhkan/);db.close();
});
test('Only private chats may run social commands even if groups enabled',async()=>{
 const {db,core}=setup();const out=[];
 const handle=createWhatsAppHandler({core,allowGroups:true,sendText:async(_jid,text)=>out.push(text),sendButtons:async()=>({sent:true})});
 const result=await handle({key:{remoteJid:'a@g.us',participant:'a@s.whatsapp.net',id:'g1',fromMe:false},message:{conversation:'.pay enable'}});
 assert.equal(result.ignored,'social-private-only');assert.match(out[0],/chat pribadi/);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM social_settings').get().n,0);db.close();
});
