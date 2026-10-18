import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
const T=Date.parse('2026-10-18T09:00:00+07:00');
function env(){const db=openDatabase(':memory:');const c=createCore(db);let counter=0;const cmd=(id,command,now=T,key)=>c.process({senderId:id,eventKey:key??`v21:${++counter}`,text:command,now});return {db,c,cmd};}
function setV(db,user,amount){db.prepare('UPDATE wallets SET balance=? WHERE user_id=?').run(amount,user);}
function create(e){e.cmd('owner','.ping');e.cmd('alice','.nick Alice');e.cmd('bob','.nick Bob');setV(e.db,'owner',500);setV(e.db,'alice',300);setV(e.db,'bob',300);assert.match(e.cmd('owner','.guild create NightWolves'),/berhasil didirikan/);}
test('v2.1 guild create, join, and private member list',()=>{const e=env();create(e);assert.match(e.cmd('alice','.guild join NightWolves'),/Bergabung/);assert.match(e.cmd('alice','.guild members'),/OWNER/);assert.equal(e.c.getCommunityStats().guilds,1);assert.equal(e.c.getCommunityStats().members,2);e.db.close();});
test('v2.1 only one guild per player, unique names, member cap semantics',()=>{const e=env();create(e);assert.match(e.cmd('owner','.guild create Other'),/sudah/);assert.match(e.cmd('bob','.guild create nightwolves'),/digunakan/);e.db.close();});
test('v2.1 guild treasury deposits debit exactly once and cannot withdraw',()=>{const e=env();create(e);const before=e.db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('owner').balance;const a=e.cmd('owner','.guild donate 100',T,'same-donation');const again=e.cmd('owner','.guild donate 100',T,'same-donation');assert.equal(again,a);assert.equal(e.db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('owner').balance,before-100);assert.equal(e.c.getCommunityStats().treasury,100);assert.match(e.cmd('owner','.guild withdraw 10'),/Gunakan|Treasury|.guild/);e.db.close();});
test('v2.1 hall upgrade consumes treasury and increases daily quest',()=>{const e=env();create(e);e.cmd('alice','.guild join NightWolves');e.cmd('alice','.guild donate 150');assert.match(e.cmd('owner','.guild upgrade'),/level 2/);assert.match(e.cmd('alice','.guild quest'),/12 Guild XP/);assert.match(e.cmd('alice','.guild quest',T+10000),/diklaim/);e.db.close();});
test('v2.1 officer permissions and ownership transfer',()=>{const e=env();create(e);e.cmd('alice','.guild join NightWolves');assert.match(e.cmd('alice','.guild upgrade'),/Hanya/);assert.match(e.cmd('owner','.guild promote Alice'),/selesai/);assert.match(e.cmd('owner','.guild leave'),/Owner harus/);assert.match(e.cmd('owner','.guild transfer-owner Alice'),/selesai/);assert.match(e.cmd('owner','.guild leave'),/Keluar/);assert.match(e.cmd('alice','.guild info'),/OWNER/);e.db.close();});
test('v2.1 invalid commands do not debit, negative balance prevented',()=>{const e=env();e.cmd('owner','.ping');setV(e.db,'owner',2);assert.match(e.cmd('owner','.property buy home'),/Butuh/);assert.match(e.cmd('owner','.guild create XYZ'),/memerlukan/);assert.equal(e.db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('owner').balance,2);assert.equal(e.c.getCommunityStats().guilds,0);e.db.close();});
test('v2.1 property purchase and daily collect once per WIB day',()=>{const e=env();e.cmd('owner','.ping');setV(e.db,'owner',400);assert.match(e.cmd('owner','.property buy workshop'),/berhasil dibeli/);assert.match(e.cmd('owner','.property collect workshop'),/Copper/);assert.match(e.cmd('owner','.property collect workshop',T+100),/sudah/);assert.equal(e.db.prepare("SELECT quantity FROM wow_materials WHERE user_id='owner' AND ore='Copper'").get().quantity,1);assert.equal(e.db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('owner').balance,300);e.db.close();});
test('v2.1 property upgrade pays V and materials',()=>{const e=env();e.cmd('owner','.ping');setV(e.db,'owner',500);e.cmd('owner','.property buy home');e.db.prepare("INSERT INTO wow_materials(user_id,ore,quantity) VALUES('owner','Copper',3)").run();assert.match(e.cmd('owner','.property upgrade home'),/Lv.2/);assert.match(e.cmd('owner','.property collect home'),/10 XP/);assert.equal(e.db.prepare('SELECT quantity FROM wow_materials WHERE user_id=? AND ore=?').get('owner','Copper').quantity,2);e.db.close();});
test('v2.1 no direct V transfer is reintroduced',()=>{const e=env();create(e);assert.match(e.cmd('owner','.pay 10 Alice'),/DILARANG|dilarang|nonaktif/i);assert.throws(()=>e.db.prepare("INSERT INTO transfers(id,sender_id,receiver_id,amount,day,created_at) VALUES('x','owner','alice',10,'2026-10-18',1)").run(),/disabled/);e.db.close();});
test('v2.1 property effects and guild survive database reopen',()=>{const e=env();create(e);e.cmd('owner','.property buy home');const dump=e.db.prepare('SELECT slug,treasury FROM wow_guilds').get();assert.equal(dump.slug,'nightwolves');assert.equal(e.db.prepare("SELECT kind FROM wow_properties WHERE user_id='owner'").get().kind,'home');e.db.close();});
test('v2.1 owner can disband empty guild but history stays',()=>{const e=env();create(e);assert.match(e.cmd('owner','.guild disband'),/ditutup/);assert.equal(e.c.getCommunityStats().guilds,0);assert.equal(e.db.prepare("SELECT kind FROM wow_guild_history WHERE kind='DISBAND'").get().kind,'DISBAND');e.db.close();});
test('v2.1 deterministic contract: no new game counted; member activities not rewarded as V wagers',()=>{const e=env();create(e);let before=e.db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('owner').balance; e.cmd('owner','.guild quest');assert.equal(e.db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('owner').balance,before);assert.match(e.cmd('owner','.wow community'),/WOW COMMUNITY/);e.db.close();});

test('v2.1 real SQLite file persists guild, treasury and property across reopen',async()=>{
  const {mkdtempSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const folder=mkdtempSync(join(tmpdir(),'wow21-'));
  try{
    const location=join(folder,'world.sqlite');
    let db=openDatabase(location);let core=createCore(db);let i=0;
    const call=(id,txt)=>core.process({senderId:id,eventKey:'persist:'+(++i),text:txt,now:T});
    call('owner','.ping');db.prepare('UPDATE wallets SET balance=500 WHERE user_id=?').run('owner');
    call('owner','.guild create SnowFox');call('owner','.guild donate 30');call('owner','.property buy home');
    db.close();
    db=openDatabase(location);core=createCore(db);
    assert.equal(core.getCommunityStats().guilds,1);
    assert.equal(core.getCommunityStats().treasury,30);
    assert.equal(core.getCommunityStats().properties,1);
    const bal=db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('owner').balance;
    assert.equal(bal,340);
    assert.match(core.process({senderId:'owner',eventKey:'persist:9',text:'.property collect home',now:T}),/XP/);
    db.close();
  }finally{rmSync(folder,{recursive:true,force:true});}
});
