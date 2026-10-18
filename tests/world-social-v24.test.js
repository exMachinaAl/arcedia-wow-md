import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {createWhatsAppHandler} from '../src/wa/handler.js';
// Derive test's fixed local clock from today's WIB date; do not hardcode 2026-10-18.
const todayWib=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const T=Date.parse(`${todayWib}T10:00:00+07:00`);
const G='120000000000000@g.us'; const G2='120000000000001@g.us';
function setup(db=openDatabase(':memory:')){
 let i=0;const core=createCore(db);
 const say=(u,t,{now=T,key,group,admin=false}={})=>core.process({senderId:u,text:t,now,eventKey:key??`v24:${++i}:${u}`,context:group?{isGroup:true,chatId:group,groupAdmin:admin}:{isGroup:false,chatId:u+'@s.whatsapp.net'}});
 for(const u of ['owner','member','outsider','officer']){say(u,'.ping');db.prepare('UPDATE wallets SET balance=700 WHERE user_id=?').run(u)}
 return {db,core,say};
}
function guild(e){assert.match(e.say('owner','.guild create Aurora'),/Aurora/i);assert.match(e.say('member','.guild join Aurora'),/Aurora/i);}
function link(e){guild(e);assert.match(e.say('owner','.guildgroup link',{group:G,admin:true}),/terhubung/);}
test('v2.4 guild link requires verified WA group admin AND guild owner',()=>{
 const e=setup();guild(e);
 assert.match(e.say('owner','.guildgroup link',{group:G}),/admin grup/);
 assert.match(e.say('member','.guildgroup link',{group:G,admin:true}),/Owner/);
 assert.match(e.say('outsider','.guildgroup link',{group:G,admin:true}),/Owner/);
 assert.equal(e.core.getWorldSocialStats().linkedGroups,0);e.db.close();
});
test('v2.4 one guild cannot bind to two groups and one group cannot bind to two guilds',()=>{
 const e=setup();link(e);
 assert.match(e.say('owner','.guildgroup link',{group:G2,admin:true}),/grup lain/);
 assert.match(e.say('outsider','.guild create Rival'),/Rival/);
 assert.match(e.say('outsider','.guildgroup link',{group:G,admin:true}),/sudah terhubung/);
 assert.equal(e.core.getWorldSocialStats().linkedGroups,1);e.db.close();
});
test('v2.4 private chat does not impersonate a guild group or make a link',()=>{
 const e=setup();guild(e);
 assert.match(e.say('owner','.guildgroup link',{admin:true}),/grup WhatsApp/);
 assert.equal(e.core.getWorldSocialStats().linkedGroups,0);e.db.close();
});
test('v2.4 unbound group cannot issue guild XP or info',()=>{
 const e=setup();guild(e);
 assert.match(e.say('owner','.guildgroup quest',{group:G,admin:true}),/belum dihubungkan/);
 assert.match(e.say('owner','.guildgroup rally',{group:G,admin:true}),/belum dihubungkan/);
 assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM wow_guild_quests').get().n,0);e.db.close();
});
test('v2.4 group membership enforced and only one quest per day',()=>{
 const e=setup();link(e);
 assert.match(e.say('outsider','.guildgroup quest',{group:G}),/belum menjadi anggota/);
 assert.match(e.say('owner','.guildgroup quest',{group:G}),/Guild Quest selesai/);
 assert.match(e.say('owner','.guildgroup quest',{group:G}),/telah diklaim/);
 assert.equal(e.db.prepare('SELECT count(*) AS n FROM wow_guild_quests').get().n,1);e.db.close();
});
test('v2.4 rally requires two distinct member quests and pays XP only once',()=>{
 const e=setup();link(e);
 assert.match(e.say('owner','.guildgroup rally',{group:G}),/0\/2/);
 e.say('owner','.guildgroup quest',{group:G});assert.match(e.say('owner','.guildgroup rally',{group:G}),/1\/2/);
 e.say('member','.guildgroup quest',{group:G});const old=e.db.prepare("SELECT xp FROM wow_guilds WHERE slug='aurora'").get().xp;
 const before=e.db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('member').balance;
 assert.match(e.say('member','.guildgroup rally',{group:G}),/\+20 Guild XP/);
 assert.match(e.say('owner','.guildgroup rally',{group:G}),/sudah diklaim/);
 assert.equal(e.db.prepare("SELECT xp FROM wow_guilds WHERE slug='aurora'").get().xp,old+20);
 assert.equal(e.db.prepare('SELECT balance FROM wallets WHERE user_id=?').get('member').balance,before);
 assert.equal(e.core.getWorldSocialStats().rallies,1);e.db.close();
});
test('v2.4 group rally uses closed-day world stats bonus, not coin/game RNG',()=>{
 const e=setup();link(e);
 const Y=T-24*60*60*1000-60*60*1000;
 e.say('owner','.mine',{now:Y});e.say('owner','.mine',{now:Y+1000});e.say('owner','.mine',{now:Y+2000});
 assert.equal(e.core.getWorldSocialStats().pulse.rallyBonus,5);
 assert.match(e.say('member','.worldpulse'),/ACTIVE/);
 e.say('owner','.guildgroup quest',{group:G});e.say('member','.guildgroup quest',{group:G});
 assert.match(e.say('owner','.guildgroup rally',{group:G}),/\+25 Guild XP/);e.db.close();
});
test('v2.4 world reputation is derived from activity, not a transferable asset',()=>{
 const e=setup();const pre=e.say('member','.reputation');assert.match(pre,/NEWCOMER/);
 e.say('member','.mine');e.say('member','.world quest');
 const post=e.say('member','.reputation');assert.match(post,/Hari mining 1/);assert.match(post,/Ekspedisi 1/);
 assert.match(e.say('member','.pay 50 owner'),/nonaktif|DILARANG|dilarang/i);e.db.close();
});
test('v2.4 group board does not publish nickname without leaderboard opt-in',()=>{
 const e=setup();link(e);e.say('owner','.nick SecretOwner');e.say('member','.nick HiddenMember');
 e.say('owner','.guildgroup quest',{group:G});e.say('member','.guildgroup quest',{group:G});
 let r=e.say('owner','.guildgroup board',{group:G});assert.doesNotMatch(r,/SecretOwner|HiddenMember|@s\.whatsapp/);
 e.db.prepare('UPDATE player_stats SET ranked=1 WHERE user_id=?').run('owner');
 r=e.say('owner','.guildgroup board',{group:G});assert.match(r,/SecretOwner/);assert.doesNotMatch(r,/HiddenMember/);e.db.close();
});
test('v2.4 unlink requires BOTH guild owner and verified admin',()=>{
 const e=setup();link(e);
 assert.match(e.say('owner','.guildgroup unlink',{group:G}),/memerlukan/);
 assert.match(e.say('member','.guildgroup unlink',{group:G,admin:true}),/memerlukan/);
 assert.match(e.say('owner','.guildgroup unlink',{group:G,admin:true}),/dilepas/);
 assert.equal(e.core.getWorldSocialStats().linkedGroups,0);
 assert.match(e.say('owner','.guildgroup link',{group:G2,admin:true}),/terhubung/);e.db.close();
});
test('v2.4 duplicate eventKey is idempotent for group rally',()=>{
 const e=setup();link(e);e.say('owner','.guildgroup quest',{group:G});e.say('member','.guildgroup quest',{group:G});
 const opts={group:G,key:'v24:double'};
 const r=e.say('owner','.guildgroup rally',opts);assert.equal(e.say('owner','.guildgroup rally',opts),r);
 assert.equal(e.core.getWorldSocialStats().rallies,1);e.db.close();
});
test('v2.4 link, rally, and reputation survive database reopen',()=>{
 const folder=mkdtempSync(join(tmpdir(),'wow24-'));try{
  const path=join(folder,'world.sqlite');let e=setup(openDatabase(path));link(e);e.say('owner','.guildgroup quest',{group:G});e.say('member','.guildgroup quest',{group:G});e.say('owner','.guildgroup rally',{group:G});e.db.close();
  e=setup(openDatabase(path));assert.equal(e.core.getWorldSocialStats().linkedGroups,1);assert.equal(e.core.getWorldSocialStats().rallies,1);assert.match(e.say('member','.guildgroup rally',{group:G}),/sudah diklaim/);e.db.close();
 } finally{rmSync(folder,{recursive:true,force:true});}
});
test('v2.4 core reports aggregate guild-group statistics without exposing chat IDs',()=>{
 const e=setup();link(e);const stats=JSON.stringify(e.core.getWorldSocialStats());
 assert.match(stats,/linkedGroups/);assert.doesNotMatch(stats,/@g\.us|owner|member/);e.db.close();
});
test('v2.4 actual WA handler refuses group link when admin metadata rejects or errors',async()=>{
 const e=setup();guild(e);
 const response=[];const handler=createWhatsAppHandler({core:e.core,allowGroups:true,sendText:async(_jid,text)=>response.push(text),sendButtons:async()=>({sent:true}),getGroupAdmin:async()=>{throw Error('metadata unavailable');}});
 const msg={key:{remoteJid:G,id:'s1',participant:'owner',fromMe:false},message:{conversation:'.guildgroup link'}};
 await handler(msg);assert.match(response.join(' '),/admin grup/);
 assert.equal(e.core.getWorldSocialStats().linkedGroups,0);e.db.close();
});
