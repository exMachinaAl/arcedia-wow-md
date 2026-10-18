/** WOW v3.4 server-authoritative, one-time bound chat signatures bought only with in-game V. */
export const SIGNATURES=Object.freeze([
 Object.freeze({id:'spark',name:'Starlight',price:40,mark:'✦'}),
 Object.freeze({id:'royal',name:'Royal Crest',price:120,mark:'♛'}),
 Object.freeze({id:'guild',name:'Guild Flame',price:180,mark:'⚔'})
]);
const BY_ID=new Map(SIGNATURES.map(x=>[x.id,x]));
export function createChatSignatures(db){
 db.exec(`CREATE TABLE IF NOT EXISTS wow_chat_signatures(
  user_id TEXT NOT NULL REFERENCES users(id),signature TEXT NOT NULL,
  purchased_ms INTEGER NOT NULL,PRIMARY KEY(user_id,signature));
 CREATE TABLE IF NOT EXISTS wow_chat_signature_active(
  user_id TEXT PRIMARY KEY REFERENCES users(id),signature TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS wow_chat_signature_journal(
  event_key TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),
  signature TEXT NOT NULL,cost INTEGER NOT NULL,created_ms INTEGER NOT NULL);`);
 const owned=(id,name)=>!!db.prepare('SELECT 1 FROM wow_chat_signatures WHERE user_id=? AND signature=?').get(id,name);
 const selected=(id)=>db.prepare('SELECT signature FROM wow_chat_signature_active WHERE user_id=?').get(id)?.signature??null;
 function render(id){return BY_ID.get(selected(id))?.mark??null;}
 function execute(id,eventKey,words,at){
  const op=(words[0]??'shop').toLowerCase(),which=(words[1]??'').toLowerCase();
  if(op==='shop'||op==='list'||op==='status'){
   const active=selected(id);
   return `✨ WOW CHAT SIGNATURE — V kosmetik terikat akun\n${SIGNATURES.map(x=>`${owned(id,x.id)?'✅':'🛍️'} ${x.mark} ${x.name} [${x.id}] • ${x.price} V`).join('\n')}\nAktif: ${active??'Default EXPLORER'}\n.chatstyle signature buy ID | use ID | off`;
  }
  if(op==='off'){
   db.prepare('DELETE FROM wow_chat_signature_active WHERE user_id=?').run(id);
   return '✅ Signature dilepas. Dekorasi default tetap ada.';
  }
  if(!BY_ID.has(which))return 'Signature tidak dikenal. Lihat .chatstyle signature shop';
  if(op==='use'){
   if(!owned(id,which))return `🔒 Belum memiliki ${which}. Beli melalui .chatstyle signature buy ${which}`;
   db.prepare('INSERT INTO wow_chat_signature_active(user_id,signature) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET signature=excluded.signature').run(id,which);
   return `✅ Signature ${which} dipakai; terlihat pada dekorasi berikutnya di grup.`;
  }
  if(op==='buy'){
   const item=BY_ID.get(which);
   if(owned(id,which))return '✅ Signature sudah dimiliki. Gunakan .chatstyle signature use '+which;
   // Called inside the existing chatIdentity.command transaction.
   // Single conditional UPDATE makes no negative balance possible.
   const spend=db.prepare('UPDATE wallets SET balance=balance-? WHERE user_id=? AND balance>=?').run(item.price,id,item.price);
   if(!spend.changes)return `💰 Saldo V tidak cukup. ${item.name} perlu ${item.price} V.`;
   db.prepare('INSERT INTO wow_chat_signatures(user_id,signature,purchased_ms) VALUES(?,?,?)').run(id,which,at);
   db.prepare('INSERT INTO wow_chat_signature_journal(event_key,user_id,signature,cost,created_ms) VALUES(?,?,?,?,?)').run(eventKey,id,which,item.price,at);
   return `✅ ${item.name} terbeli seharga ${item.price} V. Aktifkan dengan .chatstyle signature use ${which}.`;
  }
  return 'Gunakan .chatstyle signature shop|buy ID|use ID|off';
 }
 return {execute,render,owned,selected};
}
