/**
 * WA-WORLD Social v0.7: consent-based contacts, no public identifiers, no unsolicited messages.
 * All commands execute inside createCore.process() BEGIN IMMEDIATE transaction.
 */
import {randomUUID} from 'node:crypto';
const DAY = now => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const choices=['batu','gunting','kertas'];
const idPattern=/^[a-f0-9-]{36}$/i;
export function makeSocialDispatcher({db,profile}){
  const resolveName=(name)=>name&&/^[A-Za-z0-9_-]{3,18}$/.test(name)?db.prepare('SELECT user_id,nickname FROM player_stats WHERE nickname=? COLLATE NOCASE').get(name):null;
  const label=(id)=>db.prepare('SELECT nickname FROM player_stats WHERE user_id=?').get(id)?.nickname || 'Unknown';
  const friendship=(a,b)=>db.prepare('SELECT 1 AS ok FROM friendships WHERE (user_a=? AND user_b=?) OR (user_a=? AND user_b=?)').get(a,b,b,a);
  const blocked=(a,b)=>db.prepare('SELECT 1 AS ok FROM social_blocks WHERE (blocker=? AND blocked=?) OR (blocker=? AND blocked=?)').get(a,b,b,a);
  const canContact=(a,b)=>a!==b&&!blocked(a,b);
  const ownNick=(id)=>Boolean(profile(id)?.nickname);
  const ref=(name,sender)=>{
    const user=resolveName(name);
    if(!user) return {error:'Pemain tidak ditemukan. Nickname harus diatur dengan .nick NAMA.'};
    if(user.user_id===sender)return {error:'Tidak bisa menargetkan akun sendiri.'};
    return {user};
  };
  const fmt=(rows)=>rows.length?rows.map(r=>r.nickname).join(', '):'Kosong';
  const friend=(sender,args,now)=>{
    const act=args[0]??'help';
    if(act==='help')return '🤝 Teman: .nick NAMA → .friend add NICK → teman .friend accept NICK. Daftar: .friend list | .friend inbox. Tolak: .friend decline NICK. Putus: .friend remove NICK. Blokir: .friend block NICK | .friend unblock NICK';
    if(act==='list'){
      const rows=db.prepare(`SELECT p.nickname FROM friendships f JOIN player_stats p ON p.user_id=CASE WHEN f.user_a=? THEN f.user_b ELSE f.user_a END WHERE (f.user_a=? OR f.user_b=?) AND p.nickname IS NOT NULL ORDER BY p.nickname LIMIT 30`).all(sender,sender,sender);
      return `🤝 Teman (${rows.length} tampil): ${fmt(rows)}`;
    }
    if(act==='inbox'){
      const rows=db.prepare(`SELECT p.nickname FROM friend_requests r JOIN player_stats p ON p.user_id=r.sender_id WHERE r.target_id=? AND r.status='PENDING' AND r.expires_at>? ORDER BY r.created_at DESC LIMIT 10`).all(sender,now);
      return `📨 Permintaan masuk: ${fmt(rows)}\nTerima: .friend accept NICK`;
    }
    const target=ref(args[1],sender);if(target.error)return target.error;
    const other=target.user.user_id;
    if(act==='block'){
      db.prepare('INSERT OR IGNORE INTO social_blocks(blocker,blocked) VALUES(?,?)').run(sender,other);
      db.prepare('DELETE FROM friendships WHERE (user_a=? AND user_b=?) OR (user_a=? AND user_b=?)').run(sender,other,other,sender);
      db.prepare(`UPDATE friend_requests SET status='DECLINED' WHERE status='PENDING' AND ((sender_id=? AND target_id=?) OR (sender_id=? AND target_id=?))`).run(sender,other,other,sender);
      return `🚫 ${target.user.nickname} diblokir. Hubungan pertemanan dihapus.`;
    }
    if(act==='unblock'){
      db.prepare('DELETE FROM social_blocks WHERE blocker=? AND blocked=?').run(sender,other);
      return `✅ Blokir ${target.user.nickname} dibuka.`;
    }
    if(!canContact(sender,other))return 'Interaksi tidak diizinkan karena blokir.';
    if(act==='remove'){
      const n=db.prepare('DELETE FROM friendships WHERE (user_a=? AND user_b=?) OR (user_a=? AND user_b=?)').run(sender,other,other,sender).changes;
      return n?'✅ Pertemanan dihapus.':'Belum berteman.';
    }
    if(act==='add'){
      if(!ownNick(sender))return 'Atur nickname dahulu: .nick NAMA';
      if(friendship(sender,other))return 'Kalian sudah berteman.';
      const pending=db.prepare(`SELECT count(*) AS n FROM friend_requests WHERE sender_id=? AND status='PENDING' AND expires_at>?`).get(sender,now).n;
      if(pending>=10)return 'Batas 10 permintaan pertemanan aktif. Coba lagi setelah kedaluwarsa.';
      const reverse=db.prepare(`SELECT 1 AS ok FROM friend_requests WHERE sender_id=? AND target_id=? AND status='PENDING' AND expires_at>?`).get(other,sender,now);
      if(reverse)return `📨 ${target.user.nickname} sudah mengirim permintaan. Gunakan .friend accept ${target.user.nickname}`;
      const n=db.prepare(`SELECT status,expires_at,created_at FROM friend_requests WHERE sender_id=? AND target_id=?`).get(sender,other);
      if(n?.status==='PENDING'&&n.expires_at>now)return 'Permintaan pertemanan masih menunggu respons.';
      if(n?.status==='DECLINED' && now-n.created_at<86400000)return 'Permintaan sebelumnya ditolak. Coba lagi setelah 24 jam.';
      db.prepare(`INSERT INTO friend_requests(sender_id,target_id,status,created_at,expires_at) VALUES(?,?,'PENDING',?,?) ON CONFLICT(sender_id,target_id) DO UPDATE SET status='PENDING',created_at=excluded.created_at,expires_at=excluded.expires_at`).run(sender,other,now,now+7*86400000);
      return `📨 Permintaan ke ${target.user.nickname} tersimpan. Minta pemain itu membuka .friend inbox; bot tidak mengirim DM otomatis.`;
    }
    if(act==='accept'||act==='decline'){
      const request=db.prepare(`SELECT status,expires_at,created_at FROM friend_requests WHERE sender_id=? AND target_id=?`).get(other,sender);
      if(!request||request.status!=='PENDING'||request.expires_at<=now)return 'Tidak ada permintaan aktif dari pemain itu.';
      db.prepare('UPDATE friend_requests SET status=? WHERE sender_id=? AND target_id=?').run(act==='accept'?'ACCEPTED':'DECLINED',other,sender);
      if(act==='accept')db.prepare('INSERT OR IGNORE INTO friendships(user_a,user_b) VALUES(?,?)').run(...[sender,other].sort());
      return act==='accept'?`🤝 Kamu dan ${target.user.nickname} sekarang berteman.`:`✅ Permintaan ${target.user.nickname} ditolak.`;
    }
    return 'Perintah tidak dikenal. Gunakan .friend help';
  };
  // v1.9 permanent ban: no user-to-user V-Currency transfers. Old journal retained read-only.
  const pay=()=> '🔒 TRANSFER V-CURRENCY DILARANG di WOW. Tidak ada top-up, cash-out, atau transfer antarpemain. Gunakan .vshop / .craft / .arcade v.';
  const duel=(sender,args,now)=>{
    const act=args[0]??'help';
    if(act==='help')return '⚔️ Duel Suit tanpa taruhan: .duel invite NICK → .duel inbox → .duel accept ID → kedua pemain .duel pick ID batu|gunting|kertas. .duel status ID / .duel cancel ID. ID dapat disalin dari inbox.';
    if(act==='inbox'){
      const rows=db.prepare(`SELECT id,player_a,created_at FROM duels WHERE player_b=? AND status='INVITED' AND expires_at>? ORDER BY created_at DESC LIMIT 5`).all(sender,now);
      return rows.length?'⚔️ Tantangan masuk:\n'+rows.map(r=>`${r.id} dari ${label(r.player_a)} · .duel accept ${r.id}`).join('\n'):'Belum ada tantangan aktif.';
    }
    if(act==='invite'){
      const target=ref(args[1],sender);if(target.error)return target.error;
      const other=target.user.user_id;
      if(!canContact(sender,other)||!friendship(sender,other))return 'Duel hanya boleh antar teman tanpa blokir.';
      if(!ownNick(sender))return 'Atur nickname dahulu: .nick NAMA';
      const active=db.prepare(`SELECT COUNT(*) AS n FROM duels WHERE (player_a=? OR player_b=?) AND status IN ('INVITED','ACTIVE') AND expires_at>?`).get(sender,sender,now).n;
      if(active>=5)return 'Maksimal 5 duel aktif/undangan per pemain.';
      const todayInvites=db.prepare('SELECT COUNT(*) AS n FROM duels WHERE player_a=? AND created_at>=?').get(sender,now-86400000).n;
      if(todayInvites>=15)return 'Maksimal 15 tantangan per 24 jam.';
      const id=randomUUID();
      db.prepare(`INSERT INTO duels(id,player_a,player_b,status,created_at,expires_at) VALUES(?,?,?,'INVITED',?,?)`).run(id,sender,other,now,now+10*60000);
      return `⚔️ Tantangan terkirim ke inbox ${target.user.nickname}. ID: ${id}\nMinta teman menjalankan .duel inbox (tidak ada DM otomatis).`;
    }
    const id=args[1];if(!idPattern.test(id??''))return 'Masukkan ID duel valid dari .duel inbox.';
    const row=db.prepare('SELECT * FROM duels WHERE id=?').get(id);
    if(!row||![row.player_a,row.player_b].includes(sender))return 'Duel tidak ditemukan.';
    if(row.expires_at<=now && ['INVITED','ACTIVE'].includes(row.status)){
      db.prepare(`UPDATE duels SET status='EXPIRED' WHERE id=?`).run(id);return 'Duel kedaluwarsa. Buat undangan baru.';
    }
    if(act==='status'){
      const mine=db.prepare('SELECT 1 AS ok FROM duel_moves WHERE duel_id=? AND user_id=?').get(id,sender);
      const finished=row.status==='DONE'?`Hasil: ${row.winner_id?(row.winner_id===sender?'KAMU MENANG':`${label(row.winner_id)} menang`):'SERI'}`:'Belum selesai';
      return `⚔️ ${row.status} · ${finished}\nGerakan kamu: ${mine?'sudah dipilih':'belum dipilih'} (rahasia sampai selesai).`;
    }
    if(act==='cancel'){
      if(!['INVITED','ACTIVE'].includes(row.status))return 'Duel sudah selesai/dibatalkan.';
      db.prepare(`UPDATE duels SET status='CANCELLED' WHERE id=?`).run(id);return '✅ Duel dibatalkan.';
    }
    if(act==='decline'&&row.player_b===sender&&row.status==='INVITED'){
      db.prepare(`UPDATE duels SET status='DECLINED' WHERE id=?`).run(id);return '✅ Duel ditolak.';
    }
    if(act==='accept'){
      if(row.player_b!==sender||row.status!=='INVITED')return 'Hanya penerima undangan aktif yang bisa menerima.';
      if(!canContact(row.player_a,row.player_b)||!friendship(row.player_a,row.player_b))return 'Pertemanan atau izin tidak tersedia.';
      db.prepare(`UPDATE duels SET status='ACTIVE' WHERE id=?`).run(id);
      return `✅ Duel aktif. Ketik .duel pick ${id} batu|gunting|kertas`;
    }
    if(act==='pick'){
      if(row.status!=='ACTIVE')return 'Duel belum aktif/selesai. Penerima harus .duel accept ID.';
      if(!canContact(row.player_a,row.player_b)||!friendship(row.player_a,row.player_b))return 'Duel ditangguhkan: pertemanan atau izin telah dicabut.';
      const move=args[2];if(!choices.includes(move))return 'Pilih batu | gunting | kertas.';
      const moved=db.prepare('INSERT OR IGNORE INTO duel_moves(duel_id,user_id,move) VALUES(?,?,?)').run(id,sender,move);
      if(!moved.changes)return 'Kamu sudah memilih. Menunggu teman.';
      const picks=db.prepare('SELECT user_id,move FROM duel_moves WHERE duel_id=?').all(id);
      if(picks.length!==2)return '✅ Pilihan disimpan secara rahasia. Menunggu gerakan teman.';
      const a=picks.find(p=>p.user_id===row.player_a).move,b=picks.find(p=>p.user_id===row.player_b).move;
      const winner=a===b?null:((a==='batu'&&b==='gunting')||(a==='gunting'&&b==='kertas')||(a==='kertas'&&b==='batu'))?row.player_a:row.player_b;
      db.prepare(`UPDATE duels SET status='DONE',winner_id=?,completed_at=? WHERE id=?`).run(winner,now,id);
      return `🏁 Duel selesai! ${label(row.player_a)}: ${a}; ${label(row.player_b)}: ${b}. ${winner?label(winner)+' menang!':'SERI!'}\nTidak ada V-Currency dipertaruhkan.`;
    }
    return 'Gunakan .duel help';
  };
  return (sender,eventKey,text,now)=>{
    const args=text.trim().split(/\s+/),cmd=args.shift()?.toLowerCase();
    if(cmd==='.friend')return friend(sender,args,now);
    if(cmd==='.pay')return pay(sender,args,now);
    if(cmd==='.duel')return duel(sender,args,now);
    if(cmd==='.social')return '🌐 Social Hub: .friend help | .duel help. Transfer V dinonaktifkan permanen; tanpa top-up / cash-out.';
    return null;
  };
}
