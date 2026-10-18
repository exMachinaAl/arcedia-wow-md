/** WOW v2.1: Guild and Property Engine. Strictly non-cash and nontransferable V.
 * All commands execute inside core.process BEGIN IMMEDIATE SQLite transaction.
 * Event-key idempotency is enforced by core, guild-specific daily uniqueness by SQLite.
 */
const dayWIB = now => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const BUILDINGS = Object.freeze({
  home:{name:'Rumah',cost:70,upgrade:30,ore:'Copper',benefit:'+5 XP /hari dari .property collect home'},
  workshop:{name:'Workshop',cost:100,upgrade:45,ore:'Iron',benefit:'+1 Copper material /hari dari .property collect workshop'},
  quarry:{name:'Tambang Pribadi',cost:130,upgrade:60,ore:'Crystal',benefit:'+1 Iron material /hari dari .property collect quarry'}
});
const guildNameOk=name=>/^[A-Za-z][A-Za-z0-9_-]{2,19}$/.test(name);
const slug=s=>s.toLowerCase();
const n=(db,sql,...params)=>Number(db.prepare(sql).get(...params)?.n??0);
export function initWorldCommunity(db){
  db.exec(`
    CREATE TABLE IF NOT EXISTS wow_guilds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
      owner_id TEXT NOT NULL REFERENCES users(id),
      treasury INTEGER NOT NULL DEFAULT 0 CHECK(treasury>=0),
      closed INTEGER NOT NULL DEFAULT 0 CHECK(closed IN(0,1)),
      xp INTEGER NOT NULL DEFAULT 0 CHECK(xp>=0),
      hall_level INTEGER NOT NULL DEFAULT 1 CHECK(hall_level BETWEEN 1 AND 5),
      created_ms INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wow_guild_members (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      guild_id INTEGER NOT NULL REFERENCES wow_guilds(id),
      role TEXT NOT NULL CHECK(role IN ('OWNER','OFFICER','MEMBER')),
      joined_ms INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_wow_guild_members_guild ON wow_guild_members(guild_id,role);
    CREATE TABLE IF NOT EXISTS wow_guild_history (
      event_key TEXT PRIMARY KEY,
      guild_id INTEGER NOT NULL REFERENCES wow_guilds(id),
      actor_id TEXT NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      created_ms INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wow_guild_quests (
      user_id TEXT NOT NULL REFERENCES users(id),
      day TEXT NOT NULL,
      guild_id INTEGER NOT NULL REFERENCES wow_guilds(id),
      xp_awarded INTEGER NOT NULL,
      PRIMARY KEY(user_id,day)
    );
    CREATE TABLE IF NOT EXISTS wow_properties (
      user_id TEXT NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL CHECK(kind IN('home','workshop','quarry')),
      level INTEGER NOT NULL DEFAULT 1 CHECK(level BETWEEN 1 AND 3),
      bought_ms INTEGER NOT NULL,
      PRIMARY KEY(user_id,kind)
    );
    CREATE TABLE IF NOT EXISTS wow_property_collect (
      user_id TEXT NOT NULL REFERENCES users(id),
      day TEXT NOT NULL,
      kind TEXT NOT NULL,
      level INTEGER NOT NULL,
      PRIMARY KEY(user_id,day,kind)
    );
  `);
}
export function createWorldCommunity({db}){
  const balance=id=>n(db,'SELECT balance AS n FROM wallets WHERE user_id=?',id);
  const membership=id=>db.prepare('SELECT m.guild_id,m.role,g.slug,g.owner_id,g.treasury,g.xp,g.hall_level FROM wow_guild_members m JOIN wow_guilds g ON g.id=m.guild_id WHERE m.user_id=? AND g.closed=0').get(id);
  const countMembers=id=>n(db,'SELECT COUNT(*) AS n FROM wow_guild_members WHERE guild_id=?',id);
  function charge(id,amount,key,reason,now){
    if(!Number.isSafeInteger(amount)||amount<1||amount>1000)throw Error('Invalid V charge');
    if(db.prepare('SELECT 1 FROM wow_v_events WHERE event_key=?').get(key)) throw Error('Duplicate economic event');
    if(db.prepare('UPDATE wallets SET balance=balance-? WHERE user_id=? AND balance>=?').run(amount,id,amount).changes!==1)return false;
    db.prepare('INSERT INTO wow_v_events(event_key,user_id,delta,reason,day,created_ms) VALUES(?,?,?,?,?,?)')
      .run(key,id,-amount,reason,dayWIB(now),now);
    return true;
  }
  function communityStats(){
    return {guilds:n(db,'SELECT count(*) AS n FROM wow_guilds WHERE closed=0'),members:n(db,'SELECT count(*) AS n FROM wow_guild_members'),treasury:n(db,'SELECT coalesce(sum(treasury),0) AS n FROM wow_guilds'),properties:n(db,'SELECT count(*) AS n FROM wow_properties'),guildQuests:n(db,'SELECT count(*) AS n FROM wow_guild_quests')};
  }
  function guild(id,key,args,now){
    const op=args[0]??'help';const m=membership(id);
    if(op==='create'){
      const name=args[1]??'';
      if(!guildNameOk(name))return 'Nama guild 3–20 karakter, diawali huruf; hanya huruf/angka/_/-. Contoh: .guild create NightWolves';
      if(m)return 'Anda sudah menjadi anggota guild. Keluar dahulu.';
      if(db.prepare('SELECT id FROM wow_guilds WHERE slug=?').get(slug(name)))return 'Nama guild sudah digunakan.';
      if(!charge(id,60,`guild-create:${key}`,'guild:founding',now))return `Mendirikan guild memerlukan 60 V. Saldo ${balance(id)} V.`;
      const g=db.prepare('INSERT INTO wow_guilds(slug,owner_id,created_ms) VALUES(?,?,?)').run(slug(name),id,now).lastInsertRowid;
      db.prepare("INSERT INTO wow_guild_members(user_id,guild_id,role,joined_ms) VALUES(?,?,'OWNER',?)").run(id,g,now);
      db.prepare("INSERT INTO wow_guild_history(event_key,guild_id,actor_id,kind,amount,created_ms) VALUES(?,? ,?,'CREATE',60,?)").run(key,g,id,now);
      return `🏰 Guild ${name} berhasil didirikan (60 V). Undang anggota dengan .guild join ${name}\nTreasury hanya bisa untuk upgrade guild, bukan ditarik.`;
    }
    if(op==='join'){
      if(m)return 'Anda sudah bergabung dalam guild.';
      const name=args[1];if(!name)return 'Gunakan .guild join NAMAGUILD';
      const g=db.prepare('SELECT id,slug FROM wow_guilds WHERE slug=? AND closed=0').get(slug(name));
      if(!g)return 'Guild tidak ditemukan.';
      if(countMembers(g.id)>=20)return 'Guild sudah penuh (20 anggota).';
      db.prepare("INSERT INTO wow_guild_members(user_id,guild_id,role,joined_ms) VALUES(?,?,'MEMBER',?)").run(id,g.id,now);
      db.prepare("INSERT INTO wow_guild_history(event_key,guild_id,actor_id,kind,amount,created_ms) VALUES(?,?,?,'JOIN',0,?)").run(key,g.id,id,now);
      return `🤝 Bergabung dengan ${g.slug}. Anggota ${countMembers(g.id)}/20. Ikuti .guild quest untuk membantu guild.`;
    }
    if(op==='list'){
      const rows=db.prepare('SELECT g.slug,g.xp,g.hall_level,count(m.user_id) AS players FROM wow_guilds g JOIN wow_guild_members m ON m.guild_id=g.id WHERE g.closed=0 GROUP BY g.id ORDER BY g.xp DESC,g.id LIMIT 10').all();
      return rows.length?'🏆 GUILD RANKING (nama guild saja)\n'+rows.map((g,i)=>`${i+1}. ${g.slug} · Hall ${g.hall_level} · ${g.xp} XP · ${g.players} anggota`).join('\n'):'Belum ada guild.';
    }
    if(!m)return '🏰 WOW GUILD\n.guild create NAMA (60 V) | .guild join NAMA | .guild list\nAnggota guild maksimum 20. Transfer V langsung dilarang.';
    if(op==='info'||op==='help')return `🏰 ${m.slug} | Hall ${m.hall_level}/5 | Guild XP ${m.xp}\nPeran ${m.role} · Anggota ${countMembers(m.guild_id)}/20 · Kas ${m.treasury} V\n.guild members | quest | donate JUMLAH | upgrade | leave\nOwner: .guild promote USERNICK | demote USERNICK | kick USERNICK | transfer-owner USERNICK | disband\nKas guild hanya digunakan untuk upgrade guild.`;
    if(op==='members'){
      const rows=db.prepare('SELECT p.nickname,m.role FROM wow_guild_members m LEFT JOIN player_stats p ON p.user_id=m.user_id WHERE m.guild_id=? ORDER BY CASE m.role WHEN \'OWNER\' THEN 0 WHEN \'OFFICER\' THEN 1 ELSE 2 END,p.nickname LIMIT 20').all(m.guild_id);
      return `👥 ${m.slug} (${rows.length})\n${rows.map(x=>`${x.role}: ${x.nickname??'(nickname privat)'}`).join('\n')}`;
    }
    if(op==='quest'){
      const day=dayWIB(now);
      if(db.prepare('SELECT 1 FROM wow_guild_quests WHERE user_id=? AND day=?').get(id,day))return 'Misi guild harian telah diklaim. Reset 00.00 WIB.';
      const gain=10+(m.hall_level-1)*2;
      db.prepare('INSERT INTO wow_guild_quests(user_id,day,guild_id,xp_awarded) VALUES(?,?,?,?)').run(id,day,m.guild_id,gain);
      db.prepare('UPDATE wow_guilds SET xp=xp+? WHERE id=?').run(gain,m.guild_id);
      db.prepare('UPDATE player_stats SET xp=xp+3 WHERE user_id=?').run(id);
      db.prepare("INSERT INTO wow_guild_history(event_key,guild_id,actor_id,kind,amount,created_ms) VALUES(?,?,?,'QUEST',?,?)").run(key,m.guild_id,id,gain,now);
      return `📜 Guild Quest selesai! +${gain} Guild XP dan +3 XP pribadi. Tidak menghasilkan V langsung. Guild XP saat ini ${m.xp+gain}.`;
    }
    if(op==='donate'){
      const amount=Number(args[1]);if(!/^[1-9]\d{0,2}$/.test(args[1]??'')||amount>200)return 'Donasi kas guild 1–200 V per transaksi. Contoh: .guild donate 20';
      const spent=n(db,"SELECT coalesce(sum(amount),0) AS n FROM wow_guild_history WHERE actor_id=? AND kind='DONATE' AND created_ms>=? AND created_ms<?",id,Date.parse(dayWIB(now)+'T00:00:00+07:00'),Date.parse(dayWIB(now)+'T00:00:00+07:00')+86400000);
      if(spent+amount>200)return 'Batas donasi 200 V/hari per pemain.';
      if(!charge(id,amount,`guild-donate:${key}`,'guild:donation',now))return `Saldo tidak cukup (${balance(id)} V).`;
      db.prepare('UPDATE wow_guilds SET treasury=treasury+? WHERE id=?').run(amount,m.guild_id);
      db.prepare("INSERT INTO wow_guild_history(event_key,guild_id,actor_id,kind,amount,created_ms) VALUES(?,?,?,'DONATE',?,?)").run(key,m.guild_id,id,amount,now);
      return `✅ ${amount} V dimasukkan kas guild ${m.slug}. Kas sekarang ${m.treasury+amount} V. Tidak dapat ditarik.`;
    }
    if(op==='upgrade'){
      if(!['OWNER','OFFICER'].includes(m.role))return 'Hanya Owner/Officer yang boleh upgrade Hall.';
      if(m.hall_level>=5)return 'Guild Hall sudah level maksimum 5.';
      const cost=m.hall_level*100;
      if(db.prepare('UPDATE wow_guilds SET treasury=treasury-?,hall_level=hall_level+1 WHERE id=? AND treasury>=? AND hall_level=?').run(cost,m.guild_id,cost,m.hall_level).changes!==1)return `Kas guild kurang. Biaya naik dari level ${m.hall_level} adalah ${cost} V.`;
      db.prepare("INSERT INTO wow_guild_history(event_key,guild_id,actor_id,kind,amount,created_ms) VALUES(?,?,?,'UPGRADE',?,?)").run(key,m.guild_id,id,cost,now);
      return `🏰 Guild Hall ${m.slug} naik level ${m.hall_level+1}! Biaya ${cost} V dari kas guild. Misi harian berikutnya menghasilkan Guild XP lebih banyak.`;
    }
    if(op==='disband'){
      if(m.role!=='OWNER')return 'Hanya owner yang bisa membubarkan guild.';
      if(countMembers(m.guild_id)!==1)return 'Guild hanya boleh dibubarkan jika semua anggota lain sudah keluar.';
      if(m.treasury>0)return 'Kas guild masih berisi V. Habiskan untuk upgrade, tidak bisa dicairkan atau dikembalikan.';
      db.prepare('UPDATE wow_guilds SET closed=1 WHERE id=? AND closed=0').run(m.guild_id);
      db.prepare('DELETE FROM wow_guild_members WHERE user_id=?').run(id);
      db.prepare("INSERT INTO wow_guild_history(event_key,guild_id,actor_id,kind,amount,created_ms) VALUES(?,?,?,'DISBAND',0,?)").run(key,m.guild_id,id,now);
      return `🏰 Guild ${m.slug} ditutup. Riwayat tetap tersimpan untuk audit.`;
    }
    if(op==='leave'){
      if(m.role==='OWNER')return 'Owner harus mengalihkan kepemimpinan dahulu (.guild transfer-owner NICKNAME) sebelum keluar.';
      db.prepare('DELETE FROM wow_guild_members WHERE user_id=?').run(id);
      db.prepare("INSERT INTO wow_guild_history(event_key,guild_id,actor_id,kind,amount,created_ms) VALUES(?,?,?,'LEAVE',0,?)").run(key,m.guild_id,id,now);
      return `🚪 Keluar dari ${m.slug}. Donasi sebelumnya tidak bisa dikembalikan.`;
    }
    if(['promote','demote','kick','transfer-owner'].includes(op)){
      if(m.role!=='OWNER')return 'Hanya pemilik guild yang dapat mengelola anggota.';
      const nick=args[1];if(!nick)return `Gunakan .guild ${op} NICKNAME`;
      const target=db.prepare('SELECT m.user_id,m.role FROM wow_guild_members m JOIN player_stats p ON p.user_id=m.user_id WHERE m.guild_id=? AND lower(p.nickname)=lower(?)').get(m.guild_id,nick);
      if(!target||target.user_id===id)return 'Target tidak valid atau bukan anggota guild lain.';
      if(op==='kick')db.prepare('DELETE FROM wow_guild_members WHERE user_id=?').run(target.user_id);
      else if(op==='promote')db.prepare("UPDATE wow_guild_members SET role='OFFICER' WHERE user_id=?").run(target.user_id);
      else if(op==='demote')db.prepare("UPDATE wow_guild_members SET role='MEMBER' WHERE user_id=?").run(target.user_id);
      else {
        db.prepare("UPDATE wow_guild_members SET role='MEMBER' WHERE user_id=?").run(id);
        db.prepare("UPDATE wow_guild_members SET role='OWNER' WHERE user_id=?").run(target.user_id);
        db.prepare('UPDATE wow_guilds SET owner_id=? WHERE id=?').run(target.user_id,m.guild_id);
      }
      db.prepare('INSERT INTO wow_guild_history(event_key,guild_id,actor_id,kind,amount,created_ms) VALUES(?,?,?,?,0,?)').run(key,m.guild_id,id,op.toUpperCase(),now);
      return `✅ Pengelolaan guild ${op} untuk ${nick} selesai.`;
    }
    return 'Gunakan .guild info | quest | donate JUMLAH | upgrade | members | leave';
  }
  function syncMiningMaterials(id,now){
    const rows=db.prepare('SELECT event_key,ore FROM world_mining WHERE user_id=? ORDER BY day,action_no').all(id);
    for(const r of rows){
      if(!db.prepare('INSERT OR IGNORE INTO wow_material_claims(source_event,user_id,ore,claimed_ms) VALUES(?,?,?,?)').run(r.event_key,id,r.ore,now).changes)continue;
      db.prepare('INSERT INTO wow_materials(user_id,ore,quantity) VALUES(?,?,1) ON CONFLICT(user_id,ore) DO UPDATE SET quantity=quantity+1').run(id,r.ore);
    }
  }
  function property(id,key,args,now){
    syncMiningMaterials(id,now);
    const op=args[0]??'list';
    if(op==='list'||op==='help'){
      const owned=db.prepare('SELECT kind,level FROM wow_properties WHERE user_id=? ORDER BY kind').all(id);
      return `🏡 WOW PROPERTY\nMilik: ${owned.length?owned.map(x=>`${BUILDINGS[x.kind].name} Lv.${x.level}`).join(', '):'Belum ada'}\n${Object.entries(BUILDINGS).map(([k,v])=>`${k} ${v.cost} V · ${v.benefit}`).join('\n')}\n.property buy home|workshop|quarry\n.property upgrade JENIS | .property collect JENIS`;
    }
    const kind=args[1];const b=BUILDINGS[kind];if(!b)return 'Pilih home | workshop | quarry.';
    const existing=db.prepare('SELECT level FROM wow_properties WHERE user_id=? AND kind=?').get(id,kind);
    if(op==='buy'){
      if(existing)return 'Properti ini sudah Anda miliki.';
      if(!charge(id,b.cost,`property-buy:${key}`,`property:buy:${kind}`,now))return `Butuh ${b.cost} V, saldo ${balance(id)} V.`;
      db.prepare('INSERT INTO wow_properties(user_id,kind,level,bought_ms) VALUES(?,?,1,?)').run(id,kind,now);
      return `🏡 ${b.name} Lv.1 berhasil dibeli (${b.cost} V). Ini aset pribadi, tidak bisa dijual/ditransfer. ${b.benefit}`;
    }
    if(!existing)return 'Anda belum memiliki properti tersebut. .property buy '+kind;
    if(op==='upgrade'){
      if(existing.level>=3)return 'Properti ini sudah mencapai Lv.3.';
      const cost=b.upgrade*existing.level;
      const ores=existing.level;
      const available=n(db,'SELECT quantity AS n FROM wow_materials WHERE user_id=? AND ore=?',id,b.ore);
      if(available<ores)return `Upgrade butuh ${ores} ${b.ore}; tersedia ${available}. Gunakan .mine untuk material.`;
      if(!charge(id,cost,`property-upgrade:${key}`,`property:upgrade:${kind}`,now))return `Butuh ${cost} V, saldo ${balance(id)} V.`;
      db.prepare('UPDATE wow_materials SET quantity=quantity-? WHERE user_id=? AND ore=? AND quantity>=?').run(ores,id,b.ore,ores);
      db.prepare('UPDATE wow_properties SET level=level+1 WHERE user_id=? AND kind=?').run(id,kind);
      return `🔨 ${b.name} sekarang Lv.${existing.level+1} (biaya ${cost} V + ${ores} ${b.ore}).`;
    }
    if(op==='collect'){
      const day=dayWIB(now);
      if(!db.prepare('INSERT OR IGNORE INTO wow_property_collect(user_id,day,kind,level) VALUES(?,?,?,?)').run(id,day,kind,existing.level).changes)return 'Bonus properti sudah diklaim hari ini.';
      if(kind==='home'){
        const xp=5*existing.level;
        db.prepare('UPDATE player_stats SET xp=xp+? WHERE user_id=?').run(xp,id);
        return `🏡 Istirahat Rumah Lv.${existing.level}: +${xp} XP. Reset 00.00 WIB.`;
      }
      const ore=kind==='workshop'?'Copper':'Iron';
      db.prepare('INSERT INTO wow_materials(user_id,ore,quantity) VALUES(?,?,?) ON CONFLICT(user_id,ore) DO UPDATE SET quantity=quantity+excluded.quantity').run(id,ore,existing.level);
      return `🏭 ${b.name} Lv.${existing.level}: +${existing.level} ${ore}. Reset 00.00 WIB.`;
    }
    return 'Gunakan .property list | buy | upgrade | collect';
  }
  function dispatch(id,key,text,now){
    const parts=text.trim().split(/\s+/),cmd=parts[0].toLowerCase(),args=parts.slice(1);
    if(cmd==='.guild')return guild(id,key,args,now);
    if(cmd==='.property'||cmd==='.properties')return property(id,key,args,now);
    if(cmd==='.wow'&&['community','guild','property'].includes(args[0]))return '🏙️ WOW COMMUNITY\n.guild info / create NAMA / join NAMA / list\n.property list / buy JENIS / upgrade JENIS / collect JENIS\nV tidak bisa di-top-up, cash-out, ditransfer ke pemain, atau diuangkan.';
    return null;
  }
  return {dispatch,stats:communityStats};
}
