import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {PANELS,BUTTON_COMMANDS,nativePayload,sendButtonExperiment} from '../src/wa/buttons.js';
import {parseIncoming} from '../src/wa/message.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';
const at=(v)=>Date.parse(v);
const now=at('2026-10-17T03:00:00.000Z');
const setup=(randomInt=()=>0)=>{const db=openDatabase(':memory:');const core=createCore(db,{randomInt});return {db,core,send:(text,key='k',senderId='Alice',when=now)=>core.process({senderId,eventKey:key,text,now:when})};};
const msg=(message,id='m1',jid='alice@s.whatsapp.net')=>({key:{remoteJid:jid,id,fromMe:false},message});
const proto=(()=>{const make={create:v=>v};return {Message:{InteractiveMessage:Object.assign(make,{Header:make,Body:make,Footer:make,NativeFlowMessage:make})}}})();

test('daily claim is once per WIB calendar day even with new event keys; duplicate message never double credits',()=>{
  const {db,send}=setup();
  assert.match(send('.daily','a'),/\+10 V-Currency/);
  assert.match(send('.daily','b'),/sudah diklaim/);
  assert.equal(db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('Alice').balance,10);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM daily_claims').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n,1);
  assert.equal(send('.daily','a'),send('.daily','a'));
  db.close();
});
test('Asia/Jakarta boundary at 00:00 WIB and streak increments',()=>{
  const {db,send}=setup();
  const justBefore=at('2026-10-16T16:59:59.000Z'),justAfter=at('2026-10-16T17:00:00.000Z');
  send('.daily','1','Alice',justBefore);
  assert.match(send('.daily','2','Alice',justAfter),/Streak 2 hari/);
  assert.equal(db.prepare('SELECT balance FROM wallets').get().balance,20);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM daily_claims').get().n,2);
  db.close();
});
test('missed day resets streak and game daily cap does not block free daily claim',()=>{
  const {db,send}=setup();
  send('.daily','a','Alice',at('2026-10-14T10:00:00Z'));
  assert.match(send('.daily','b','Alice',now),/Streak 1 hari/);
  for(let i=0;i<40;i++)send('.coin kepala','c'+i);
  assert.equal(db.prepare('SELECT earned FROM daily_game_earnings').get().earned,100);
  assert.equal(db.prepare('SELECT balance FROM wallets').get().balance,120);
  assert.match(send('.coin kepala','last'),/Batas hadiah game/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ledger WHERE reason=?').get('coin-win').n,34);
  db.close();
});
test('duplicate game event does not increment XP, plays or money twice',()=>{
  const {db,send}=setup();
  const first=send('.coin kepala','ev');
  assert.equal(first,send('.coin kepala','ev'));
  const s=db.prepare('SELECT xp,plays,wins FROM player_stats').get();
  assert.deepEqual({...s},{xp:6,plays:1,wins:1});
  assert.match(send('.profile','profile'),/Level: 1/);
  db.close();
});
test('scoreboard opt-in, unique nickname, leave and no public phone IDs',()=>{
  const {db,send}=setup();
  send('.coin kepala','a','628123456789@s.whatsapp.net');
  assert.match(send('.rank','b','Bob'),/Belum ada/);
  assert.match(send('.rank join','c','628123456789@s.whatsapp.net'),/Atur nickname/);
  send('.nick TesterA','d','628123456789@s.whatsapp.net');
  send('.rank join','e','628123456789@s.whatsapp.net');
  const board=send('.rank','f','Bob');
  assert.match(board,/TesterA/);assert.doesNotMatch(board,/628123456789/);
  assert.match(send('.nick testera','g','Bob'),/sudah digunakan/);
  send('.rank leave','h','628123456789@s.whatsapp.net');
  assert.match(send('.rank','i','Bob'),/Belum ada/);
  db.close();
});
test('legacy v0.3 database migration preserves wallets and ledger and adds new tables',()=>{
  const db=openDatabase(':memory:');
  db.prepare('INSERT INTO users(id) VALUES(?)').run('legacy');
  db.prepare('INSERT INTO wallets(user_id,balance) VALUES(?,?)').run('legacy',99);
  db.prepare('INSERT INTO ledger(user_id,delta,reason,event_key) VALUES(?,?,?,?)').run('legacy',99,'prior','prior:1');
  const core=createCore(db);
  assert.match(core.process({senderId:'legacy',eventKey:'upgrade',text:'.profile',now}),/99 V-Currency/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n,1);
  assert.equal(db.prepare('SELECT xp FROM player_stats WHERE user_id=?').get('legacy').xp,0);
  db.close();
});
test('panel mappings are allowlisted and every quick reply resolves to action',()=>{
  for(const [name,panel] of Object.entries(PANELS)) {
    assert.equal(panel.buttons.length,3,name);
    const native=nativePayload(proto,{panelName:name,body:'Hello'});
    for(const btn of native.interactiveMessage.nativeFlowMessage.buttons) {
      const {id}=JSON.parse(btn.buttonParamsJson);
      assert.equal(typeof BUTTON_COMMANDS[id],'string');
      const parsed=parseIncoming(msg({interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:JSON.stringify({id})}}}));
      assert.equal(parsed.text,BUTTON_COMMANDS[id]);
    }
  }
  assert.equal(parseIncoming(msg({interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:'{"id":"waw:unknown"}'}}})),null);
});
test('WhatsApp home->games->coin->result and daily button execute on same profile',async()=>{
  const {db,core}=setup();const sent=[],panels=[];
  const handle=createWhatsAppHandler({core,sendText:async(_jid,text)=>sent.push(text),sendButtons:async(_jid,mode,_quoted,opts)=>{panels.push(opts);return {sent:true,stage:'relayed-unverified'};}});
  const reply=id=>({interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:JSON.stringify({id})}}});
  await handle(msg({conversation:'.menu'},'a'));
  assert.equal(panels.at(-1).panelName,'home');
  await handle(msg(reply('waw:games'),'b'));
  assert.equal(panels.at(-1).panelName,'games');
  await handle(msg(reply('waw:coin'),'c'));
  assert.equal(panels.at(-1).panelName,'coin');
  await handle(msg(reply('waw:coin:kepala'),'d'));
  assert.match(sent.at(-1),/Menang/);
  await handle(msg(reply('waw:daily'),'e'));
  assert.match(sent.at(-1),/Daily berhasil/);
  assert.equal(db.prepare('SELECT balance FROM wallets').get().balance,13);
  db.close();
});
test('native panel keeps relay metadata and sends no fake separate message',async()=>{
  const relayed=[],fake=[];
  const sock={user:{id:'bot@s.whatsapp.net'},sendMessage:async(...args)=>fake.push(args),relayMessage:async(...args)=>relayed.push(args)};
  const baileys={proto,generateWAMessageFromContent:(jid,message)=>({key:{id:'panel-1'},message})};
  const r=await sendButtonExperiment({sock,jid:'alice@s.whatsapp.net',mode:'native',baileys,panelName:'games',body:'3 game active'});
  assert.equal(r.sent,true);assert.equal(fake.length,0);assert.equal(relayed.length,1);
  const [,packet,opts]=relayed[0];
  assert.match(packet.interactiveMessage.body.text,/3 game active/);
  assert.deepEqual(packet.interactiveMessage.nativeFlowMessage.buttons.map(b=>JSON.parse(b.buttonParamsJson).id),['waw:coin','waw:rps','waw:guess']);
  assert.equal(opts.additionalNodes[0].content[0].attrs.type,'native_flow');
});
