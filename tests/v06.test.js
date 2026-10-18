import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db.js';
import {createCore,GAMES} from '../src/core.js';
import {createAIService} from '../src/ai/engine.js';
import {PANELS,BUTTON_COMMANDS} from '../src/wa/buttons.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';
const now=Date.parse('2026-10-17T04:00:00.000Z');
function setup(draw=min=>min){const db=openDatabase(':memory:');const core=createCore(db,{randomInt:draw});let count=0;return {db,core,send:(text,id='p')=>core.process({senderId:id,eventKey:`v06:${id}:${++count}`,text,now})};}
function okText(s){return new Response(JSON.stringify({response:s}),{status:200,headers:{'content-type':'application/json'}});}
test('Game Pack 02 retains 16 existing games and registers eight unique new games',()=>{
 assert.ok(GAMES.length>=24);assert.equal(new Set(GAMES.map(g=>g.id)).size,GAMES.length);
 for(const id of ['binary','roman','equation','prime','sort','logic','digit','alphabet'])assert.ok(GAMES.some(g=>g.id===id));
});
test('Eight puzzles playable with independent sessions and correct-answer rewards',()=>{
 const {db,send}=setup();const trials=[['binary','100'],['roman','i'],['equation','1'],['prime','prima'],['sort','1, 11, 21, 31'],['logic','false'],['digit','1'],['alphabet','b']];
 for(const [game,answer] of trials){assert.match(send(`.${game} start`),/dimulai/,game);assert.match(send(`.${game} ${answer}`),/Tepat/,game);}
 assert.equal(db.prepare('SELECT plays FROM player_stats').get().plays,8);
 assert.equal(db.prepare('SELECT balance FROM wallets').get().balance,72);db.close();
});
test('Puzzle progress isolated, expires, and duplicate message rewards only once',()=>{
 const {db,core,send}=setup();send('.roman start','A');send('.roman start','B');
 assert.match(send('.roman i','B'),/Tepat/);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM challenge_sessions WHERE game=?').get('roman').n,1);
 const msg={senderId:'A',eventKey:'one:puzzle',text:'.roman i',now};
 assert.equal(core.process(msg),core.process(msg));
 assert.equal(db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('A').balance,9);
 assert.match(core.process({senderId:'A',eventKey:'expire:start',text:'.binary start',now}),/dimulai/);
 assert.match(core.process({senderId:'A',eventKey:'expire:answer',text:'.binary 100',now:now+16*60_000}),/kadaluarsa/);
 db.close();
});
test('wrong answers and invalid input never mint extra V-Currency',()=>{
 const {db,send}=setup();send('.binary start');assert.match(send('.binary 0'),/Salah/);assert.match(send('.binary 0'),/Jawaban/);
 assert.match(send('.binary 100'),/kadaluarsa/);assert.equal(db.prepare('SELECT COALESCE(sum(delta),0) AS n FROM ledger').get().n,0);db.close();
});
test('new interactive packs remain allowlisted with exactly 3 buttons each',()=>{
 for(const pack of ['packs','packs2','numbers','logic','ai']){
  assert.equal(PANELS[pack].buttons.length,3);
  for(const b of PANELS[pack].buttons)assert.equal(BUTTON_COMMANDS[b.id],b.command);
 }
});
test('AI requires consent and never calls model if disabled',async()=>{
 const {db}=setup();let calls=0;
 const ai=createAIService(db,{enabled:false,fetchFn:()=>{calls++;return Promise.resolve(okText('x'));}});
 assert.match(await ai.perform({senderId:'p',eventKey:'a',text:'.ai ask halo semua',now}),/belum diaktifkan/);
 assert.match(await ai.perform({senderId:'p',eventKey:'b',text:'.ai consent',now}),/Izin/);
 assert.match(await ai.perform({senderId:'p',eventKey:'c',text:'.ai ask halo semua',now}),/belum diaktifkan/);
 assert.equal(calls,0);db.close();
});
test('AI local-only URL prevents external / credentialed inference endpoints',()=>{
 const {db}=setup();for(const url of ['https://127.0.0.1:11434','http://example.org:11434','http://root:pass@localhost:11434','http://127.0.0.1:11434/custom'])assert.throws(()=>createAIService(db,{url}),/local Ollama/);db.close();
});
test('AI text mode local Ollama request, consent, idempotency and quota accounting',async()=>{
 const {db}=setup();let calls=0;let captured;
 const ai=createAIService(db,{enabled:true,fetchFn:async(url,options)=>{calls++;captured={url,body:JSON.parse(options.body)};return okText('Algoritma adalah langkah-langkah.');}});
 assert.match(await ai.perform({senderId:'p',eventKey:'nopermission',text:'.ai ask Apa itu algoritma?',now}),/Aktifkan izin/);
 await ai.perform({senderId:'p',eventKey:'consent',text:'.ai consent',now});
 const msg={senderId:'p',eventKey:'only:one',text:'.ai ask Apa itu algoritma?',now};
 const a=await ai.perform(msg);assert.match(a,/Algoritma/);assert.equal(await ai.perform(msg),a);
 assert.equal(calls,1);assert.equal(captured.url,'http://127.0.0.1:11434/api/generate');assert.equal(captured.body.stream,false);
 assert.equal(ai.stats('p',now).count,1);db.close();
});
test('AI structured JSON schema is passed to Ollama and output is validated',async()=>{
 const {db}=setup();let passedFormat=null;
 const ai=createAIService(db,{enabled:true,fetchFn:async(_url,opts)=>{passedFormat=JSON.parse(opts.body).format;return okText(JSON.stringify({title:'Halo',answer:'Dunia',tags:['ilmu','tes']}));}});
 await ai.perform({senderId:'p',eventKey:'consent',text:'.ai consent',now});
 const result=await ai.perform({senderId:'p',eventKey:'json1',text:'.ai json Jelaskan algoritma',now});
 assert.match(result,/"title":"Halo"/);assert.deepEqual(passedFormat.required,['title','answer','tags']);db.close();
});
test('AI errors do not debit quota and revoked permission deletes cached answers',async()=>{
 const {db}=setup();let offline=true;
 const ai=createAIService(db,{enabled:true,fetchFn:async()=>{if(offline)throw Error('Ollama down');return okText('Berhasil');}});
 await ai.perform({senderId:'p',eventKey:'optin',text:'.ai consent',now});
 assert.match(await ai.perform({senderId:'p',eventKey:'model',text:'.ai ask Tes server lokal',now}),/belum merespons/);
 assert.equal(ai.stats('p',now).count,0);offline=false;
 assert.match(await ai.perform({senderId:'p',eventKey:'model',text:'.ai ask Tes server lokal',now}),/Berhasil/);
 assert.equal(ai.stats('p',now).count,1);
 assert.match(await ai.perform({senderId:'p',eventKey:'off',text:'.ai off',now}),/dihapus/);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ai_replies').get().n,0);
 assert.match(await ai.perform({senderId:'p',eventKey:'new',text:'.ai ask Tes server lokal',now}),/Aktifkan izin/);db.close();
});
test('AI user-specific rate limit, prompt-length guard and global concurrency',async()=>{
 const {db}=setup();let resolveRemote;
 const ai=createAIService(db,{enabled:true,maxConcurrent:1,fetchFn:()=>new Promise(resolve=>{resolveRemote=resolve;})});
 await ai.perform({senderId:'a',eventKey:'consent',text:'.ai consent',now});
 await ai.perform({senderId:'b',eventKey:'consent',text:'.ai consent',now});
 assert.match(await ai.perform({senderId:'a',eventKey:'long',text:'.ai ask '+ 'x'.repeat(510),now}),/3–500/);
 const pending=ai.perform({senderId:'a',eventKey:'ask',text:'.ai ask Pertanyaan pertama',now});
 assert.match(await ai.perform({senderId:'b',eventKey:'other',text:'.ai ask Pertanyaan kedua',now}),/sibuk/);
 resolveRemote(okText('Oke'));assert.match(await pending,/Oke/);assert.equal(ai.stats('b',now).count,0);db.close();
});
test('WhatsApp handler connects AI button click to local AI opt-in',async()=>{
 const {db,core}=setup();const replies=[];const panels=[];
 const aiService=createAIService(db,{enabled:false});
 const handle=createWhatsAppHandler({core,aiService,sendText:async(_j,msg)=>replies.push(msg),sendButtons:async(_j,_mode,_m,opts)=>{panels.push(opts.panelName);return {sent:true};}});
 const incoming=(id,msgId)=>({key:{remoteJid:'12345@s.whatsapp.net',id:msgId,fromMe:false},message:{interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:JSON.stringify({id})}}}});
 await handle(incoming('waw:ai:consent','x'));
 assert.match(replies.at(-1),/Izin/);assert.equal(aiService.preferences('12345@s.whatsapp.net'),true);
 await handle(incoming('waw:ai:status','y'));
 assert.match(replies.at(-1),/AI: OFF/);db.close();
});

test('WhatsApp parser accepts bounded 500-char AI prompts, rejects oversized messages',async()=>{
 const {parseIncoming}=await import('../src/wa/message.js');
 const inbound=text=>({message:{conversation:text}});
 assert.equal(parseIncoming(inbound('.ai ask '+'x'.repeat(500))).source,'text');
 assert.equal(parseIncoming(inbound('.ai ask '+'x'.repeat(900))),null);
});
test('native long game list keeps fallback commands visible within body budget',async()=>{
 const {nativePayload}=await import('../src/wa/buttons.js');
 const make={create:x=>x};const proto={Message:{InteractiveMessage:Object.assign(make,{Header:make,Body:make,Footer:make,NativeFlowMessage:make})}};
 const result=nativePayload(proto,{panelName:'games',body:'x'.repeat(2000)}).interactiveMessage.body.text;
 assert.ok(result.length<=1000);assert.match(result,/Jika tombol tidak tampil/);assert.match(result,/\.games all/);
});
