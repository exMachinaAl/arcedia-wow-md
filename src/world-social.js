/** WOW v2.4 World Social: group-scoped guild collaboration and public, auditable world pulse.
 * All mutations are serialized by createCore's SQLite transaction and message ID dedupe.
 * Group links require BOTH authenticated group administrator status and current guild owner role.
 * No V-Currency transfer or chance-game manipulation exists here.
 */
import {createHash} from 'node:crypto';
const DAY = now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const n=(db,sql,...args)=>Number(db.prepare(sql).get(...args)?.n??0);
const dateBefore=(now,d)=>DAY(now-d*86400000);
export function initWorldSocial(db){
 db.exec(`
 CREATE TABLE IF NOT EXISTS wow_guild_group_links(
  chat_id TEXT PRIMARY KEY, guild_id INTEGER NOT NULL UNIQUE REFERENCES wow_guilds(id),
  linked_by TEXT NOT NULL REFERENCES users(id), linked_ms INTEGER NOT NULL
 );
 CREATE TABLE IF NOT EXISTS wow_guild_rallies(
  guild_id INTEGER NOT NULL REFERENCES wow_guilds(id), day TEXT NOT NULL,
  participants INTEGER NOT NULL CHECK(participants>=2), xp INTEGER NOT NULL CHECK(xp BETWEEN 20 AND 30),
  actor_id TEXT NOT NULL REFERENCES users(id), created_ms INTEGER NOT NULL,
  PRIMARY KEY(guild_id,day)
 );
 CREATE TABLE IF NOT EXISTS wow_guild_group_audit(
  event_key TEXT PRIMARY KEY, guild_id INTEGER NOT NULL REFERENCES wow_guilds(id),
  chat_hash TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK(action IN('LINK','UNLINK','RALLY')),
  created_ms INTEGER NOT NULL
 );
 `);
}
export function createWorldSocial({db,community}){
 const linkFor=chatId=>db.prepare('SELECT l.guild_id,g.slug,g.xp,g.hall_level FROM wow_guild_group_links l JOIN wow_guilds g ON g.id=l.guild_id WHERE l.chat_id=? AND g.closed=0').get(chatId);
 const membership=id=>db.prepare('SELECT g.id,g.slug,g.xp,m.role FROM wow_guild_members m JOIN wow_guilds g ON g.id=m.guild_id WHERE m.user_id=? AND g.closed=0').get(id);
 const hashChat=chatId=>createHash('sha256').update(chatId).digest('hex').slice(0,16);
 const audit=(key,gid,chatId,id,action,now)=>db.prepare('INSERT INTO wow_guild_group_audit(event_key,guild_id,chat_hash,actor_id,action,created_ms) VALUES(?,?,?,?,?,?)').run(key,gid,hashChat(chatId),id,action,now);
 function pulse(now){
  // Read only a CLOSED day. Current-day activity never alters public bonus mid-session.
  const prev=dateBefore(now,1);
  const mines=n(db,'SELECT count(*) AS n FROM world_mining WHERE day=?',prev);
  const guilds=n(db,'SELECT count(DISTINCT guild_id) AS n FROM wow_guild_quests WHERE day=?',prev);
  const explorers=n(db,'SELECT count(*) AS n FROM wow_world_quests WHERE day=?',prev);
  const volume=n(db,'SELECT coalesce(sum(delta),0) AS n FROM wow_v_events WHERE day=? AND delta>0',prev);
  const tier=mines>=12&&guilds>=2?'BUSY':mines>=3||guilds>=1||explorers>=2?'ACTIVE':'CALM';
  // Guild XP only; no V issuance and no effect on luck, odds, or payout.
  const extra=tier==='BUSY'?10:tier==='ACTIVE'?5:0;
  return {day:prev,mines,guilds,explorers,issuedV:volume,tier,rallyBonus:extra};
 }
 function reputation(id){
  const daysMining=n(db,'SELECT count(DISTINCT day) AS n FROM world_mining WHERE user_id=?',id);
  const expeditions=n(db,'SELECT count(*) AS n FROM wow_world_quests WHERE user_id=?',id);
  const guildQuests=n(db,'SELECT count(*) AS n FROM wow_guild_quests WHERE user_id=?',id);
  const seasons=n(db,'SELECT count(*) AS n FROM wow_season_claims WHERE user_id=?',id);
  const score=Math.min(1000,Math.min(100,daysMining)*3+Math.min(100,expeditions)*4+Math.min(100,guildQuests)*5+Math.min(30,seasons)*10);
  const tier=score>=350?'LEGEND':score>=120?'VETERAN':score>=30?'EXPLORER':'NEWCOMER';
  return {score,tier,daysMining,expeditions,guildQuests,seasons};
 }
 function group(id,key,args,now,ctx){
  const cmd=args[0]??'help';const isGroup=ctx?.isGroup===true&&typeof ctx.chatId==='string'&&ctx.chatId.endsWith('@g.us');
  if(!isGroup)return '🏰 WOW GUILD GROUP (dalam grup WhatsApp)\nOwner guild sekaligus admin grup: .guildgroup link\nAnggota: .guildgroup quest | .guildgroup rally | .guildgroup board\nAdmin+Owner: .guildgroup unlink\nWA_ENABLE_GROUPS=true diperlukan.';
  const g=linkFor(ctx.chatId),m=membership(id);
  if(cmd==='link'){
   if(!ctx.groupAdmin)return '⛔ Hanya admin grup WhatsApp yang terverifikasi dapat mengaitkan guild.';
   if(!m||m.role!=='OWNER')return '⛔ Hanya Owner guild yang juga admin grup boleh mengaitkan guild.';
   if(g)return 'Grup ini sudah terhubung ke guild '+g.slug+'.';
   if(db.prepare('SELECT 1 FROM wow_guild_group_links WHERE guild_id=?').get(m.id))return 'Guild Anda sudah ditautkan ke grup lain. Lepaskan tautan lama dahulu.';
   db.prepare('INSERT INTO wow_guild_group_links(chat_id,guild_id,linked_by,linked_ms) VALUES(?,?,?,?)').run(ctx.chatId,m.id,id,now);
   audit(key,m.id,ctx.chatId,id,'LINK',now);
   return `✅ Grup terhubung ke guild ${m.slug}. Anggota dapat menggunakan .guildgroup quest dan .guildgroup rally.`;
  }
  if(!g)return 'Grup ini belum dihubungkan ke WOW Guild. Owner guild yang menjadi admin grup dapat mengetik .guildgroup link.';
  if(cmd==='unlink'){
   if(!ctx.groupAdmin||!m||m.id!==g.guild_id||m.role!=='OWNER')return '⛔ Unlink memerlukan Owner guild sekaligus admin grup.';
   db.prepare('DELETE FROM wow_guild_group_links WHERE chat_id=? AND guild_id=?').run(ctx.chatId,g.guild_id);
   audit(key,g.guild_id,ctx.chatId,id,'UNLINK',now);
   return `🔓 Guild ${g.slug} berhasil dilepas dari grup. Riwayat audit tetap tersimpan.`;
  }
  if(cmd==='info'||cmd==='help'||cmd==='status'){
   const members=n(db,'SELECT count(*) AS n FROM wow_guild_members WHERE guild_id=?',g.guild_id);
   return `🏰 WOW GUILD GROUP • ${g.slug}\nHall Lv.${g.hall_level} · Guild XP ${g.xp} · Anggota ${members}\n.quest: .guildgroup quest\n.rally: .guildgroup rally\n.board: .guildgroup board\nWorld pulse: .worldpulse\nKas anggota tetap privat; tidak ada transfer V.`;
  }
  if(!m||m.id!==g.guild_id)return 'Anda belum menjadi anggota guild yang terhubung dengan grup ini. Bergabung melalui DM terlebih dahulu.';
  if(cmd==='quest')return community.dispatch(id,key,'.guild quest',now);
  if(cmd==='board'){
   const rows=db.prepare(`SELECT q.user_id,count(*) AS days,sum(q.xp_awarded) AS xp,p.nickname,p.ranked FROM wow_guild_quests q
    JOIN player_stats p ON p.user_id=q.user_id WHERE q.guild_id=? AND q.day>=?
    GROUP BY q.user_id ORDER BY xp DESC,q.user_id LIMIT 8`).all(g.guild_id,dateBefore(now,6));
   return `🏆 KONTRIBUSI GUILD ${g.slug} · 7 HARI\n${rows.length?rows.map((r,i)=>`${i+1}. ${r.ranked===1&&r.nickname?r.nickname:`Anonim #${i+1}`} · ${r.xp} XP (${r.days} hari)`).join('\n'):'Belum ada quest pekan ini.'}\nNickname hanya ditampilkan jika pemain opt-in leaderboard.`;
  }
  if(cmd==='rally'){
   const day=DAY(now);
   if(db.prepare('SELECT 1 FROM wow_guild_rallies WHERE guild_id=? AND day=?').get(g.guild_id,day))return 'Guild Rally hari ini sudah diklaim. Reset 00.00 WIB.';
   const participants=n(db,'SELECT count(DISTINCT user_id) AS n FROM wow_guild_quests WHERE guild_id=? AND day=?',g.guild_id,day);
   if(participants<2)return `🤝 Guild Rally perlu 2 anggota unik menyelesaikan Guild Quest hari ini (${participants}/2). Jalankan .guildgroup quest.`;
   const bonus=pulse(now).rallyBonus,award=20+bonus;
   db.prepare('INSERT INTO wow_guild_rallies(guild_id,day,participants,xp,actor_id,created_ms) VALUES(?,?,?,?,?,?)').run(g.guild_id,day,participants,award,id,now);
   db.prepare('UPDATE wow_guilds SET xp=xp+? WHERE id=? AND closed=0').run(award,g.guild_id);
   audit(key,g.guild_id,ctx.chatId,id,'RALLY',now);
   return `🤝 GUILD RALLY ${g.slug}: ${participants} anggota aktif! +${award} Guild XP (dasar 20 + World Pulse ${bonus}). Tidak mencetak V. Satu klaim/guild/hari.`;
  }
  return 'Gunakan .guildgroup info | quest | rally | board | unlink';
 }
 function dispatch(id,key,text,now,ctx={}){
  const parts=text.trim().toLowerCase().split(/\s+/);
  if(parts[0]==='.guildgroup')return group(id,key,parts.slice(1),now,ctx);
  if(parts[0]==='.worldpulse'){
   const p=pulse(now);
   return `🌍 WORLD PULSE (${p.day}, aktivitas kemarin)\n${p.tier}: ${p.mines} mining · ${p.explorers} ekspedisi · ${p.guilds} guild aktif\nV diterbitkan (jurnal WOW): ${p.issuedV}\nGuild Rally bonus hari ini: +${p.rallyBonus} XP. Statistik publik agregat, tidak mengubah RNG.`;
  }
  if(parts[0]==='.reputation'){
   const p=reputation(id);
   return `🌟 WORLD REPUTATION: ${p.tier} · ${p.score}/1000\nHari mining ${p.daysMining} · Ekspedisi ${p.expeditions} · Guild Quest ${p.guildQuests} · Musim ${p.seasons}\nHanya bukti aktivitas; bukan sertifikasi anti-cheat, bukan penentu peluang menang.`;
  }
  return null;
 }
 function stats(now=Date.now()){
  const p=pulse(now);
  return {linkedGroups:n(db,'SELECT count(*) AS n FROM wow_guild_group_links'),rallies:n(db,'SELECT count(*) AS n FROM wow_guild_rallies'),rallyXp:n(db,'SELECT coalesce(sum(xp),0) AS n FROM wow_guild_rallies'),pulse:p};
 }
 return {dispatch,stats,pulse,reputation};
}
