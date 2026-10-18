/**
 * WhatsApp chess notification dispatcher. SQLite is the durable source of truth.
 * At-least-once delivery: ambiguous network failures can cause duplicate messages;
 * never mark an event delivered before the transport resolves.
 */
export function createChessNotifier({core,sendText,sendImage,isConnected=()=>true,log=()=>{}}){
  if(!core?.claimChessNotifications||typeof sendText!=='function')throw Error('Invalid chess notifier dependencies');
  let busy=false;
  const privateJid=jid=>typeof jid==='string' && /@(s\.whatsapp\.net|lid)$/.test(jid);
  async function flush(now=Date.now()){
    if(busy||!isConnected())return {status:'offline-or-busy',sent:0};
    busy=true;let sent=0,failed=0;
    try {
      const events=core.claimChessNotifications({now,limit:12});
      for(const event of events){
        try {
          if(!privateJid(event.recipient))throw Error('Invalid private WhatsApp JID');
          const board=event.show_board?core.getChessBoard({senderId:event.recipient,matchId:event.match_id}):null;
          if(board && typeof sendImage==='function'){
            try{await sendImage(event.recipient,board.png,event.body);}
            catch(error){log('board-fallback',error.message);await sendText(event.recipient,event.body+'\n⚠️ Gambar belum terkirim; ketik .chess board.');}
          } else await sendText(event.recipient,event.body);
          core.ackChessNotification(event.id,now);
          sent++;
        }catch(error){core.failChessNotification(event.id,error.message,now);failed++;log('failed',String(error.message).slice(0,120));}
      }
      return {status:'processed',sent,failed};
    } finally {busy=false;}
  }
  return {flush};
}
