/** Outbox delivery for blackjack. Exactly-once mutation, at-least-once notifications. */
export function createBlackjackNotifier({core,sendText,sendCard=null,sendControls=null,isConnected=()=>true,log=()=>{}}){
 let busy=false;
 async function flush(now=Date.now()){
  if(busy||!isConnected())return {sent:0,pending:true};busy=true;let sent=0,failed=0;
  try{for(const event of core.claimBlackjackNotifications({now,limit:12})){
    try{await sendText(event.recipient,event.body);core.ackBlackjackNotification(event.id,now);sent++;
      // Best effort card preview. Text notification is acknowledged independently.
      if(!event.recipient.endsWith('@g.us') && /:start:|:hit:|:stand:/.test(event.event_key)) {
        if(sendCard)try{await sendCard(event.recipient);}catch(e){log('bj-card',String(e.message).slice(0,120));}
        if(sendControls)try{await sendControls(event.recipient);}catch(e){log('bj-controls',String(e.message).slice(0,120));}
      }}
    catch(error){core.failBlackjackNotification(event.id,error.message,now);failed++;log('bj-delivery',String(error.message).slice(0,120));}
  }return {sent,failed};}finally{busy=false;}
 }
 return {flush};
}
