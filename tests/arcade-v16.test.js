import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db.js';
import {createCore,GAMES} from '../src/core.js';
import {longestRun} from '../src/arcade.js';

function fixture(options={}){
 const dir=mkdtempSync(join(tmpdir(),'ww-arcade-'));
 const path=join(dir,'world.sqlite');const db=openDatabase(path),core=createCore(db,{...options,...(options.codeGenerator?{arcadeCodeGenerator:options.codeGenerator}:{})});
 let seq=0;const now=Date.parse('2026-10-18T08:00:00+07:00');
 const run=(id,text,when=now,key=null)=>core.process({senderId:id,eventKey:key??`evt:${++seq}`,text,now:when});
 const close=()=>{db.close();rmSync(dir,{recursive:true,force:true});};
 return {dir,path,db,core,run,close,now};
}
const advance=86400000;
test('v1.6 three unique arcade games registered',()=>{
 assert.equal(new Set(GAMES.map(g=>g.id)).size,GAMES.length);
 for(const id of ['gacha','symbolmatch','riskroom'])assert.ok(GAMES.some(g=>g.id===id));
});
test('v1.6 run length longest streak with exactly ten symbols',()=>{
 assert.equal(longestRun(['🍒','🍒','⭐','⭐','⭐','💎','💎','💎','💎','⭐']),4);
 assert.equal(longestRun(Array(10).fill('🍒')),10);
 assert.throws(()=>longestRun(['🍒']));
});
test('v1.6 gacha fixed published odds and single daily free claim',()=>{
 const f=fixture({randomInt:(lo,hi)=>lo});try{
   assert.match(f.run('alice','.gacha odds'),/70%/);
   assert.match(f.run('alice','.gacha claim'),/Bronze Star/);
   assert.match(f.run('alice','.gacha claim'),/sudah dibuka/);
   assert.match(f.run('alice','.gacha collection'),/1\/4/);
   assert.match(f.run('alice','.gacha claim',f.now+advance),/KAPSUL GRATIS/);
   assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM arcade_capsules').get().n,2);
   assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM arcade_cosmetics').get().n,1);
 }finally{f.close();}
});
test('v1.6 rarest cosmetic is possible and owned',()=>{
 const f=fixture({randomInt:(min,max)=>max-1});try{
   assert.match(f.run('a','.gacha claim'),/Celestial Crown/);
   assert.match(f.run('a','.gacha collection'),/LEGENDARY/);
 }finally{f.close();}
});
test('v1.6 slot ten matches earns non-transferable score, no wallet credit',()=>{
 const f=fixture({randomInt:()=>0});try{
   const before=f.run('a','.wallet');
   assert.match(f.run('a','.slot spin'),/10 simbol identik/);
   assert.equal(f.db.prepare('SELECT longest_run,score FROM arcade_spins').get().longest_run,10);
   assert.equal(f.db.prepare('SELECT longest_run,score FROM arcade_spins').get().score,640);
   assert.equal(f.run('a','.wallet'),before);
   assert.match(f.run('a','.arcade'),/Skor hiburan: 640/);
 }finally{f.close();}
});
test('v1.6 slot limits three free plays daily, never debits wallet',()=>{
 const f=fixture();try{
   for(let i=0;i<3;i++)assert.match(f.run('a','.slot spin'),/SYMBOL MATCH/);
   assert.match(f.run('a','.slot spin'),/Batas 3 spin/);
   assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM arcade_spins WHERE user_id=?').get('a').n,3);
   assert.match(f.run('a','.slot spin',f.now+advance),/SYMBOL MATCH/);
   assert.equal(f.db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('a').balance,0);
 }finally{f.close();}
});
test('v1.6 core replay same message cannot duplicate rewards',()=>{
 const f=fixture();try{
   const r1=f.run('a','.slot spin',f.now,'same'),r2=f.run('a','.slot spin',f.now,'same');
   assert.equal(r1,r2);
   assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM arcade_spins').get().n,1);
   assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM processed_messages WHERE event_key=?').get('same').n,1);
 }finally{f.close();}
});
test('v1.6 risk room needs opt-in 2 players and no monetary stake',()=>{
 const f=fixture({randomInt:()=>0,codeGenerator:()=> 'AABBCCDD'});try{
   assert.match(f.run('a','.risk create'),/AABBCCDD/);
   assert.match(f.run('a','.risk resolve AABBCCDD'),/2 peserta/);
   assert.match(f.run('b','.risk join AABBCCDD'),/Bergabung/);
   assert.match(f.run('b','.risk resolve AABBCCDD'),/Hanya pembuat/);
   assert.match(f.run('a','.risk choose AABBCCDD legend'),/10%/);
   assert.match(f.run('b','.risk choose AABBCCDD safe'),/70%/);
   const beforeA=f.run('a','.wallet');const beforeB=f.run('b','.wallet');
   assert.match(f.run('a','.risk resolve AABBCCDD'),/Ronde selesai/);
   assert.equal(f.db.prepare('SELECT score FROM risk_entries WHERE user_id=?').get('a').score,80);
   assert.equal(f.db.prepare('SELECT score FROM risk_entries WHERE user_id=?').get('b').score,10);
   assert.equal(f.run('a','.wallet'),beforeA);
   assert.equal(f.run('b','.wallet'),beforeB);
   assert.match(f.run('a','.risk resolve AABBCCDD'),/sudah selesai/);
 }finally{f.close();}
});
test('v1.6 risk room fails resolution without all choices',()=>{
 const f=fixture({codeGenerator:()=> 'ABCDE123'});try{
   f.run('a','.risk create');f.run('b','.risk join ABCDE123');
   f.run('a','.risk choose ABCDE123 balanced');
   assert.match(f.run('a','.risk resolve ABCDE123'),/belum memilih/);
   assert.equal(f.db.prepare('SELECT status FROM risk_rooms').get().status,'OPEN');
 }finally{f.close();}
});
test('v1.6 risk room can expire; members can leave and status is private',()=>{
 const f=fixture({codeGenerator:()=> 'FACEB00C'});try{
   f.run('a','.risk create');f.run('b','.risk join FACEB00C');
   assert.match(f.run('c','.risk status FACEB00C'),/Hanya peserta/);
   assert.match(f.run('b','.risk leave FACEB00C'),/keluar/);
   assert.match(f.run('a','.risk resolve FACEB00C'),/2 peserta/);
   assert.match(f.run('b','.risk join FACEB00C',f.now+1800001),/kedaluwarsa/);
 }finally{f.close();}
});
test('v1.6 cap max room creations and no item/ledger mutations',()=>{
 let num=0;const f=fixture({codeGenerator:()=> (++num).toString(16).padStart(8,'0').toUpperCase()});try{
   f.run('a','.risk create');f.run('a','.risk create');
   assert.match(f.run('a','.risk create'),/Selesaikan room/);
   assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ledger').get().n,0);
   assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM item_events').get().n,0);
 }finally{f.close();}
});
test('v1.6 restart preserves capsule and roulette room state',()=>{
 const f=fixture({codeGenerator:()=> 'DEADBEEF'});try{
   f.run('a','.gacha claim');f.run('a','.risk create');f.run('b','.risk join DEADBEEF');
   f.db.close(); const reopened=openDatabase(f.path),next=createCore(reopened);
   assert.match(next.process({senderId:'a',eventKey:'after-restart-1',text:'.gacha claim',now:f.now}),/sudah dibuka/);
   assert.match(next.process({senderId:'a',eventKey:'after-restart-2',text:'.risk status DEADBEEF',now:f.now}),/2\/8/);
   reopened.close();rmSync(f.dir,{recursive:true,force:true});
 }catch(error){rmSync(f.dir,{recursive:true,force:true});throw error;}
});
test('v1.6 invalid probability room code and command do not mutate data',()=>{
 const f=fixture();try{
   assert.match(f.run('a','.risk join ../etc'),/8 karakter/);
   assert.match(f.run('a','.gacha buy'),/Gunakan/);
   assert.match(f.run('a','.slot bet 100'),/Gunakan/);
   assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM arcade_spins').get().n,0);
 }finally{f.close();}
});

test('v1.6 native buttons expose arcade commands with allowlisted IDs', async()=>{
 const {PANELS,BUTTON_COMMANDS}=await import('../src/wa/buttons.js');
 assert.equal(PANELS.arcade.buttons.length,3);
 assert.equal(BUTTON_COMMANDS['waw:slot:spin'],'.slot spin');
 assert.equal(BUTTON_COMMANDS['waw:arc:gacha'],'.gacha');
 assert.equal(PANELS.fun.buttons.length,3);
});
