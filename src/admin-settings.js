/** WOW admin control center: trusted sender-ID allowlist, SQLite settings and immutable audit. */
const RULES=Object.freeze({
 auction:{kind:'bool',default:0},transfer:{kind:'bool',default:0},
 arcade_spend_limit:{kind:'int',default:25,min:0,max:500},
 arcade_win_limit:{kind:'int',default:100,min:0,max:1000},
 dailyshop_limit:{kind:'int',default:3,min:0,max:10},
 transfer_max:{kind:'int',default:50,min:1,max:250},
 transfer_daily_limit:{kind:'int',default:100,min:1,max:1000},
 admin_grant_limit:{kind:'int',default:10000,min:1,max:50000}
});
export const ADMIN_RULES=RULES;
export function initAdminSettings(db){
 db.exec(`CREATE TABLE IF NOT EXISTS wow_server_settings(k TEXT PRIMARY KEY,v INTEGER NOT NULL,updated_ms INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS wow_admin_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,event_key TEXT NOT NULL UNIQUE,actor_id TEXT NOT NULL,action TEXT NOT NULL,target TEXT,old_value TEXT,new_value TEXT,created_ms INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS wow_admin_grants(event_key TEXT PRIMARY KEY,actor_id TEXT NOT NULL,receiver_id TEXT NOT NULL REFERENCES users(id),amount INTEGER NOT NULL CHECK(amount>0),created_ms INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_wow_admin_grants_actor ON wow_admin_grants(actor_id,created_ms);
 CREATE TABLE IF NOT EXISTS wow_safe_transfers(event_key TEXT PRIMARY KEY,sender_id TEXT NOT NULL REFERENCES users(id),receiver_id TEXT NOT NULL REFERENCES users(id),amount INTEGER NOT NULL CHECK(amount>0),created_ms INTEGER NOT NULL, CHECK(sender_id<>receiver_id));
 CREATE INDEX IF NOT EXISTS idx_wow_safe_tx_sender ON wow_safe_transfers(sender_id,created_ms);
 CREATE INDEX IF NOT EXISTS idx_wow_safe_tx_pair ON wow_safe_transfers(sender_id,receiver_id,created_ms);
 CREATE TRIGGER IF NOT EXISTS wow_safe_transfer_policy BEFORE INSERT ON wow_safe_transfers WHEN COALESCE((SELECT v FROM wow_server_settings WHERE k='transfer'),0)<>1 BEGIN SELECT RAISE(ABORT,'V transfers disabled by admin'); END;`);
 for(const [k,rule] of Object.entries(RULES))db.prepare('INSERT OR IGNORE INTO wow_server_settings(k,v,updated_ms) VALUES(?,?,0)').run(k,rule.default);
}
export function createAdminSettings({db,adminIds=process.env.WOW_ADMIN_IDS??''}){
 const ids=new Set((Array.isArray(adminIds)?adminIds:String(adminIds).split(',')).map(x=>x.trim()).filter(Boolean));
 const isAdmin=id=>ids.has(id);
 const get=key=>{if(!Object.hasOwn(RULES,key))throw Error('Unknown setting');return db.prepare('SELECT v FROM wow_server_settings WHERE k=?').get(key)?.v??RULES[key].default;};
 const audit=(eventKey,actor,action,target,oldValue,newValue,now)=>db.prepare('INSERT INTO wow_admin_audit(event_key,actor_id,action,target,old_value,new_value,created_ms) VALUES(?,?,?,?,?,?,?)').run(eventKey,actor,action,target,String(oldValue??''),String(newValue??''),now);
 const resolve=(name,admin)=>{
  if(name==='me')return admin;
  if(!/^[A-Za-z0-9_-]{3,18}$/.test(name??''))return null;
  return db.prepare('SELECT user_id FROM player_stats WHERE nickname=? COLLATE NOCASE').get(name)?.user_id??null;
 };
 function command(id,eventKey,text,now,context={}){
  const [command,...args]=text.trim().split(/\s+/);
  if(!['.admin','.server','.transfer','.whoami'].includes(command.toLowerCase()))return null;
  if(command.toLowerCase()==='.whoami')return context.isGroup?'Gunakan .whoami melalui chat pribadi.':`🔑 ID akun WhatsApp Anda (privat): ${id}\nDaftarkan ID ini sebagai WOW_ADMIN_IDS di .env server untuk mengaktifkan admin.`;
  if(context.isGroup)return '🔒 Pengaturan server, transfer, dan ID admin hanya tersedia melalui DM.';
  if(command.toLowerCase()==='.transfer')return transfer(id,eventKey,args,now);
  if(!isAdmin(id))return '⛔ Akses ditolak: hanya admin WOW yang terdaftar di server.';
  const op=(args[0]??'show').toLowerCase();
  if(op==='show'||op==='help'||op==='limits'){
   const settings=Object.entries(RULES).map(([k,r])=>`${k}: ${r.kind==='bool'?(get(k)?'ON':'OFF'):get(k)}`).join('\n');
   const flags='Limit tetap (belum dapat diubah): slot/risk 5 V/aksi; V Arcade opt-in per akun; harga dan stok dailyshop harian; lelang akun 72 jam/10 game, 2 listing aktif, 5% fee; transfer 72 jam/10 game dan 1 jam cooldown pasangan; admin grant total maksimum 50.000 V/hari.';
   return `⚙️ WOW SERVER SETTINGS (admin)\n${settings}\n${flags}\n\n.admin set KEY NILAI | .admin grant me|NICK JUMLAH | .admin audit\nSemua perubahan berlaku langsung dan tercatat. Transfer lama .pay tetap dinonaktifkan.`;
  }
  if(op==='set'){
   const k=(args[1]??'').toLowerCase(),value=(args[2]??'').toLowerCase(),rule=RULES[k];
   if(!rule)return `Setting tidak dikenal. Gunakan .admin show untuk daftar lengkap.`;
   let n;
   if(rule.kind==='bool'){if(!['on','off','1','0'].includes(value))return `Gunakan .admin set ${k} on|off`;n=['on','1'].includes(value)?1:0;}
   else {if(!/^\d+$/.test(value))return `Gunakan angka ${rule.min}–${rule.max}.`;n=Number(value);if(!Number.isSafeInteger(n)||n<rule.min||n>rule.max)return `Batas ${k}: ${rule.min}–${rule.max}.`;}
   const before=get(k);
   if(before===n)return `${k} sudah bernilai ${rule.kind==='bool'?(n?'ON':'OFF'):n}.`;
   db.prepare('UPDATE wow_server_settings SET v=?,updated_ms=? WHERE k=?').run(n,now,k);
   audit(eventKey,id,'SETTING',k,before,n,now);
   return `✅ ${k}: ${before} → ${n}${rule.kind==='bool'?' (0=OFF,1=ON)':''}. Audit tersimpan.`;
  }
  if(op==='grant'){
   const target=resolve(args[1],id),amountText=args[2]??'',amount=Number(amountText);
   if(!target)return 'Target tidak dikenal. Gunakan me atau nickname pemain yang sudah terdaftar.';
   if(!/^\d+$/.test(amountText)||!Number.isSafeInteger(amount)||amount<1||amount>get('admin_grant_limit'))return `Jumlah 1–${get('admin_grant_limit')} V per aksi.`;
   const dayStart=Date.parse(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now))+'T00:00:00+07:00');
   const issued=db.prepare('SELECT COALESCE(SUM(amount),0) AS n FROM wow_admin_grants WHERE actor_id=? AND created_ms>=?').get(id,dayStart).n;
   if(issued+amount>50000)return `Batas grant admin 50.000 V/hari. Sisa ${Math.max(0,50000-issued)} V.`;
   db.prepare('INSERT INTO wow_admin_grants(event_key,actor_id,receiver_id,amount,created_ms) VALUES(?,?,?,?,?)').run(eventKey,id,target,amount,now);
   db.prepare('UPDATE wallets SET balance=balance+? WHERE user_id=?').run(amount,target);
   audit(`audit:${eventKey}`,id,'GRANT',target,'0',amount,now);
   return `✅ Admin grant +${amount} V ke ${args[1]}. Saldo target ${db.prepare('SELECT balance AS n FROM wallets WHERE user_id=?').get(target).n} V. Ini mata uang simulasi, bukan top-up uang asli.`;
  }
  if(op==='audit'){
   const list=db.prepare('SELECT action,target,old_value,new_value,created_ms FROM wow_admin_audit ORDER BY id DESC LIMIT 12').all();
   return '📜 WOW ADMIN AUDIT (12 terbaru)\n'+(list.map(x=>`${new Date(x.created_ms).toISOString()} ${x.action} ${x.target||''}: ${x.old_value} → ${x.new_value}`).join('\n')||'Belum ada perubahan.');
  }
  return 'Perintah: .admin show | .admin set KEY NILAI | .admin grant me|NICK V | .admin audit';
 }
 function transfer(sender,eventKey,args,now){
  if(get('transfer')!==1)return '🔒 Transfer antar pemain OFF. Hanya admin dapat mengaktifkan melalui .admin set transfer on.';
  const nick=args[0],to=resolve(nick,sender),raw=args[1]??'',amount=Number(raw);
  if(!to||to===sender||nick==='me')return 'Gunakan .transfer NICK JUMLAH (nickname pemain lain yang valid).';
  if(!/^\d+$/.test(raw)||!Number.isSafeInteger(amount)||amount<1||amount>get('transfer_max'))return `Jumlah 1–${get('transfer_max')} V per transfer.`;
  const eligible=user=>{const u=db.prepare('SELECT created_at FROM users WHERE id=?').get(user),p=db.prepare('SELECT plays FROM player_stats WHERE user_id=?').get(user);return Boolean(u&&p&&p.plays>=10&&now-Date.parse(u.created_at.replace(' ','T')+'Z')>=72*3600000);};
  if(!eligible(sender)||!eligible(to))return 'Kedua akun harus berusia minimal 72 jam dan telah memainkan 10 game.';
  const cutoff=now-86400000,stats=db.prepare('SELECT COALESCE(SUM(amount),0) AS total,COUNT(*) AS count FROM wow_safe_transfers WHERE sender_id=? AND created_ms>=?').get(sender,cutoff);
  if(stats.total+amount>get('transfer_daily_limit')||stats.count>=3)return `Batas transfer 24 jam: ${get('transfer_daily_limit')} V dan 3 transaksi.`;
  const previous=db.prepare('SELECT 1 FROM wow_safe_transfers WHERE sender_id=? AND receiver_id=? AND created_ms>=?').get(sender,to,now-3600000);
  if(previous)return 'Transfer ke pemain yang sama hanya boleh sekali per jam.';
  if(db.prepare('SELECT 1 FROM wow_guild_members a JOIN wow_guild_members b ON a.guild_id=b.guild_id WHERE a.user_id=? AND b.user_id=?').get(sender,to))return 'Transfer satu guild dinonaktifkan untuk mencegah pengumpulan V.';
  if(db.prepare('UPDATE wallets SET balance=balance-? WHERE user_id=? AND balance>=?').run(amount,sender,amount).changes!==1)return 'Saldo V tidak mencukupi.';
  db.prepare('UPDATE wallets SET balance=balance+? WHERE user_id=?').run(amount,to);
  db.prepare('INSERT INTO wow_safe_transfers(event_key,sender_id,receiver_id,amount,created_ms) VALUES(?,?,?,?,?)').run(eventKey,sender,to,amount,now);
  return `✅ Transfer ${amount} V ke ${nick} selesai. Saldo Anda ${db.prepare('SELECT balance AS n FROM wallets WHERE user_id=?').get(sender).n} V. Transfer tercatat dan tidak dapat dibatalkan.`;
 }
 return {get,isAdmin,command};
}
