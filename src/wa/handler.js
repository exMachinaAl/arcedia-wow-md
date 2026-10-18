import { parseIncoming } from './message.js';
import {tapCommand,buttonCheck,GROUP_BUTTON_SAFE_IDS,GROUP_DM_ONLY_IDS,GROUP_PUBLIC_COMMANDS,DM_HUB_PANELS} from './buttons.js';
import {unwrap} from './message.js';
import {createGroupButtonLab} from './group-buttons.js';
import {plainGroupText} from './chat-identity.js';
/** Stateless message orchestration; real UI rendering is confirmed only by receiver testing. */
export function createWhatsAppHandler({core,sendText,sendButtons,sendImage=null,aiService=null,record=()=>{},allowGroups=false,allowSender=()=>true,getGroupAdmin=async()=>false,getBotGroupAdmin=async()=>false,chatIdentity=null,groupButtonsEnabled=false}) {
  if(!core || typeof sendText!=='function' || typeof sendButtons!=='function') throw Error('Invalid handler dependencies');
  const buttonLab=createGroupButtonLab({enabled:groupButtonsEnabled});
  return async function handle(msg) {
    const jid=msg?.key?.remoteJid;
    if(!jid || msg.key.fromMe || jid==='status@broadcast' || jid.endsWith('@broadcast')) return {ignored:'outgoing/status'};
    if(jid.endsWith('@g.us') && !allowGroups) return {ignored:'group-disabled'};
    if(typeof msg.key.id!=='string' || !msg.key.id || msg.key.id.length>160) return {ignored:'missing-id'};
    const isGroup=jid.endsWith('@g.us');
    const parsed=parseIncoming(msg);
    // A trusted group member's *plain text* is eligible for the separately opted-in
    // decoration service even when WA_ALLOWED_JIDS restricts bot commands to admins.
    // A DM .chatstyle request is also required for ordinary players to opt in/out.
    // All other commands remain subject to the existing allowlist.
    const playerStyleDM=!isGroup && /^\.chatstyle(?:\s|$)/i.test(parsed?.text??'');
    const groupDecoration=isGroup && chatIdentity?.acceptsGroup?.(jid)===true && !parsed && plainGroupText(msg)!==null;
     // Only allow harmless group navigation selections, never economy/admin commands.
     const groupSelection=isGroup && parsed?.buttonId && GROUP_BUTTON_SAFE_IDS.has(parsed.buttonId);
    const groupMenu=isGroup && GROUP_PUBLIC_COMMANDS.has((parsed?.text??'').trim().toLowerCase());
     const groupFeedback=isGroup && groupButtonsEnabled && /^\.groupbuttons report (shown|hidden|clicked)(?:\s|$)/i.test(parsed?.text??'');
    if(!allowSender(msg.key.participant ?? jid,jid) && !playerStyleDM && !groupDecoration && !groupSelection && !groupFeedback && !groupMenu) return {ignored:'not-allowed'};
    if(!parsed) {
      if(chatIdentity && isGroup)return chatIdentity.ingest(msg);
      return {ignored:'not-command'};
    }
    const sender=msg.key.participant ?? jid;
    const eventKey=`wa:${jid}:${msg.key.id}:${sender}`;
    const cmd=parsed.text.trim();
    // XLICON-style mixed navigation is now the PRIMARY group UX, independently
    // of experimental Group Button Lab flags. No account economy operations here.
    if(isGroup && (groupMenu || groupSelection)){
      // Selection must run its mapped public command, never re-open groupdemo
      // regardless of the clicked ID. Private choices remain private.
      const dmOnly=GROUP_DM_ONLY_IDS.has(parsed.buttonId) || /^\.(dailyshop|inventory|arcade)(?:\s|$)/i.test(cmd);
      if(dmOnly){
        await sendText(jid,`🔒 ${cmd} adalah fitur pribadi. Buka chat pribadi bot dan jalankan ${cmd} di sana.`,msg);
        return {ok:true,action:'group-dm-guidance',command:cmd};
      }
      if(!GROUP_PUBLIC_COMMANDS.has(cmd.toLowerCase()))return {ignored:'group-navigation-not-allowed'};
      if(['.worldpulse','.reputation','.guildgroup','.season'].includes(cmd.toLowerCase())){
        const response=core.process({senderId:sender,eventKey,text:cmd,context:{chatId:jid,isGroup:true,groupAdmin:false}});
        if(response)await sendText(jid,response,msg);
        record({type:'group_public_action',command:cmd,at:Date.now()});
        return {ok:true,action:'group-public-action',command:cmd};
      }
      const sub=cmd.toLowerCase();
      const panel=sub==='.games'||sub==='.games all'?'groupgames':
        sub==='.nav more'?'groupmore':sub==='.nav arena'?'grouparena':
        sub==='.nav explore'?'groupexplore':'groupdemo';
      let response='';
      if(['.menu','.wowmenu','.help','.games','.games all'].includes(sub)){
        // Respond with actual existing WOW command output, not merely a loop.
        response=core.process({senderId:sender,eventKey,text:sub==='.wowmenu'?'.menu':sub,context:{chatId:jid,isGroup:true,groupAdmin:false}})??'';
      }else if(sub==='.nav arena')response='♟️ WOW Arena: catur, ular tangga, dan Blackjack tersedia lewat DM bot untuk menjaga status pertandingan.';
      else if(sub==='.nav more')response='📚 WOW Menu Lainnya: World Pulse, musim dunia, reputasi, guild, dan daftar permainan.';
      else if(sub==='.nav explore')response='🌍 WOW World: cek event, musim, guild, dan reputasi melalui pilihan di bawah.';
      const out=await sendButtons(jid,'mixed',msg,{panelName:panel,body:response||'🌍 WOW: pilih fitur dari daftar berikut.'});
      record({type:'group_navigation',panel,command:cmd,sent:out.sent===true,stage:out.stage??'unknown',at:Date.now()});
      return {ok:true,action:'group-main-menu',panel,command:cmd,...out};
    }
    if(jid.endsWith('@g.us') && /^\.groupbuttons(?:\s|$)/i.test(cmd)){
      let groupAdmin=false;try{groupAdmin=(await getGroupAdmin(jid,sender))===true;}catch{}
      return buttonLab.handle({jid,sender,text:cmd,groupAdmin,sendText,sendButtons,record,quoted:msg});
    }
    if(chatIdentity && /^(\.chatstyle|\.wowchat|\.admin chat)(\s|$)/i.test(cmd)){
      let groupAdmin=false;
      if(jid.endsWith('@g.us') && /^\.wowchat(?:\s|$)/i.test(cmd)){
        try{groupAdmin=(await getGroupAdmin(jid,sender))===true;}catch{groupAdmin=false;}
      }
      const m=unwrap(msg.message);
      const mentionedJids=m.extendedTextMessage?.contextInfo?.mentionedJid??[];
      let response=chatIdentity.command({senderId:sender,chatId:jid,isGroup:jid.endsWith('@g.us'),groupAdmin,mentionedJids,eventKey,text:cmd});
      if(jid.endsWith('@g.us') && /^\.wowchat diagnose(?:\s|$)/i.test(cmd) && groupAdmin){
        let verified=false;try{verified=await getBotGroupAdmin(jid)===true;}catch{}
        response+=`\nBot admin grup: ${verified?'YA':'TIDAK / tidak dapat diverifikasi'}`;
      }
      if(!isGroup && (/^\.chatstyle$/i.test(cmd) || /^\.chatstyle signature (?:shop|list|status)$/i.test(cmd))){
        await sendButtons(jid,'mixed',msg,{panelName:'wowidentityhub',body:response});
      }else await sendText(jid,response,msg);
      return {ok:true,action:'wowchat-command'};
    }
    if(jid.endsWith('@g.us') && /^\.(admin|server|transfer|whoami|social|friend|pay|duel|arena|queue|match|chess|pvp|insights|model|risk|arcade|gacha|slot|stats|smart|world|guild|property|dailyshop|dshop|auction)(\s|$)/i.test(cmd)) {
      await sendText(jid,'Fitur akun, inventory, sosial, dan matchmaking hanya tersedia di chat pribadi demi privasi.',msg);
      return {ignored:'social-private-only'};
    }
    const parts=cmd.split(/\s+/);
    const action=parts[0].toLowerCase();
    if(action==='.buttons' || action==='.testbuttons') {
      if(jid.endsWith('@g.us')) {await sendText(jid,'Uji tombol hanya tersedia di chat pribadi.',msg);return {ok:true};}
      const mode=(parts[1]??'native').toLowerCase();
      if(!['text','legacy','native','mixed','selector'].includes(mode)) {
        await sendText(jid,'Gunakan .buttons mixed | selector | native | legacy | text',msg);
        return {ok:true};
      }
      const result=await sendButtons(jid,mode,msg);
      record({type:'button_attempt',mode,sent:result.sent===true,stage:result.stage??'unknown',at:Date.now()});
      return {ok:true,action:'send-buttons',mode,...result};
    }
    if(action==='.hub'){
      if(isGroup){await sendText(jid,'Buka .menu di chat pribadi bot untuk hub interaktif dan transaksi V.',msg);return {ok:true,action:'hub-dm-only'};}
      const requested=(parts[1]??'').toLowerCase();
      const hub=DM_HUB_PANELS[requested];
      if(!hub){await sendText(jid,'🌍 WOW HUB: .hub games | world | economy | identity | arena',msg);return {ok:true,action:'hub-help'};}
      const out=await sendButtons(jid,'mixed',msg,{panelName:hub,body:`🌍 WOW ${requested.toUpperCase()} — pilih aksi langsung atau buka selector. Tindakan ekonomi tetap diverifikasi di server.`});
      record({type:'hub_navigation',hub:requested,sent:out.sent===true,stage:out.stage??'unknown',at:Date.now()});
      return {ok:true,action:'hub-navigation',hub:requested,...out};
    }
    if(action==='.buttoncheck') {
      // Legacy: .buttoncheck hidden | New: .buttoncheck native hidden
      const maybeMode=(parts[1]??'').toLowerCase();
      const mode=['native','legacy','text'].includes(maybeMode)?maybeMode:'unspecified';
      const outcome=buttonCheck(mode==='unspecified'?parts[1]:parts[2]);
      if(!outcome) {await sendText(jid,'Gunakan .buttoncheck native hidden | .buttoncheck native shown | .buttoncheck native clicked',msg);return {ok:true};}
      record({type:'button_feedback',mode,outcome,at:Date.now()});
      await sendText(jid,`🧾 Feedback ${mode}: ${outcome}. Ini hasil laporan dari perangkat Anda, bukan klaim otomatis bot.`,msg);
      return {ok:true,action:'feedback'};
    }
    let text=cmd;
    if(action==='.tap') {
      text=tapCommand(parts[1]);
      if(!text){await sendText(jid,'Gunakan .tap 1 (menu), .tap 2 (games), .tap 3 (wallet)',msg);return {ok:true};}
    }
    if(action==='.ai'){
      const response=aiService?await aiService.perform({senderId:sender,eventKey,text}):'🤖 AI lokal belum terpasang di gateway. Gunakan .ai help setelah update.';
      const sub=(text.split(/\s+/)[1]??'help').toLowerCase();
      if(['help','menu'].includes(sub) && !jid.endsWith('@g.us')){
        const out=await sendButtons(jid,'native',msg,{panelName:'ai',body:response});
        record({type:'panel_attempt',panel:'ai',sent:out.sent===true,stage:out.stage??'unknown',at:Date.now()});
      } else await sendText(jid,response,msg);
      return {ok:true,action:'ai-command',source:parsed.source};
    }
    // Fail closed: never trust sender-provided admin flags; consult group metadata.
    let groupAdmin=false;
    if(jid.endsWith('@g.us') && /^\.guildgroup (link|unlink)(?:\s|$)/i.test(text)) {
      try {groupAdmin=(await getGroupAdmin(jid,sender))===true;} catch {groupAdmin=false;}
    }
    const response=core.process({senderId:sender,eventKey,text,context:{chatId:jid,isGroup:jid.endsWith('@g.us'),groupAdmin}});
    if(/^\.stats card(?:\s|$)/i.test(text) && typeof sendImage==='function' && !jid.endsWith('@g.us')) {
      const card=core.getPlayerCardImage?.({senderId:sender});
      if(card){await sendImage(jid,card.png,card.caption,msg);return {ok:true,action:'player-stats-card-image'};}
    }
    if(/^\.match board(?:\s|$)/i.test(text) && typeof sendImage==='function' && !jid.endsWith('@g.us')) {
      const board=core.getMatchBoard?.({senderId:sender,matchId:parts[2]});
      if(board){await sendImage(jid,board.png,board.caption,msg);return {ok:true,action:'match-board-image'};}
    }
    if(/^\.(bj|blackjack) hand(?:\s|$)/i.test(text) && typeof sendImage==='function' && !jid.endsWith('@g.us')) {
      const card=core.getBlackjackImage?.({senderId:sender});
      if(card){await sendImage(jid,card.png,card.caption,msg);/* continue to controls */}
    }
    if(/^\.chess board(?:\s|$)/i.test(text) && typeof sendImage==='function' && !jid.endsWith('@g.us')) {
      const board=core.getChessBoard?.({senderId:sender,matchId:parts[2]});
      if(board){await sendImage(jid,board.png,board.caption,msg);return {ok:true,action:'chess-board-image'};}
    }
    // Blackjack status is private: image reflects the freshly committed hand, not
    // a guessed card. A separate interactive panel follows the image in the DM.
    if(/^\.(?:bj|blackjack) (?:hit|stand|start|status|join)(?:\s|$)/i.test(text) && typeof sendImage==='function' && !isGroup){
      const card=core.getBlackjackImage?.({senderId:sender});
      if(card)await sendImage(jid,card.png,card.caption,msg);
    }
    // Core response is recorded before attempting delivery; text fallback is included in the native payload.
    const resultAction=text.trim().toLowerCase();
    const chessContext=action==='.chess'?core.getChessContext?.({senderId:sender}):null;
    const bjContext=action==='.bj'||action==='.blackjack'?core.getBlackjackContext?.({senderId:sender}):null;
    const panel = resultAction==='.nav more' ? 'more' :
      resultAction==='.nav explore' ? 'explore' :
      resultAction==='.nav arena' ? 'arenanav' :
      resultAction==='.nav fun' ? 'fun' :
      action==='.stats' || action==='.smart' || (action==='.world' && ['event','events','quest','audit'].includes(parts[1]?.toLowerCase())) ? 'worldintel' :
      action==='.wow' || action==='.mine' || action==='.work' ? 'world' :
      action==='.market' ? 'market' :
      action==='.guild' ? 'guild' :
      ['.guildgroup','.worldpulse','.reputation'].includes(action) ? 'worldsocial' :
      action==='.guildshop' ? 'guildsupply' :
      action==='.season' ? 'worldseason' :
      ['.dailyshop','.dshop','.auction'].includes(action) ? 'worldmarket' :
      action==='.property'||action==='.properties' ? 'property' :
      resultAction==='.wow community' ? 'community' :
      action==='.pvp' ? 'pvp' :
      action==='.arcade' ? 'arcade' :
      action==='.gacha' ? 'gacha' :
      action==='.slot' ? 'slot' :
      action==='.risk' ? 'risk' :
      (action==='.bj'||action==='.blackjack') ? (bjContext?.phase==='ACTIVE'?'bjplay':bjContext?.phase==='LOBBY'?'bjlobby':'blackjack') :
      resultAction==='.menu'||resultAction==='.help'||resultAction==='.start' ? 'home' :
      (resultAction==='.games'||resultAction==='.play') ? 'games' :
      resultAction==='.profile' ? 'profile' :
      (action==='.inventory'||action==='.inv'||action==='.item'||action==='.collection') ? 'inventory' :
      resultAction==='.coin' ? 'coin' :
      resultAction==='.rps' ? 'rps' :
      resultAction==='.packs' ? 'packs' :
      resultAction==='.packs2' ? 'packs2' :
      resultAction==='.packs3' ? 'packs3' :
      resultAction==='.packs4' ? 'packs4' :
      resultAction==='.pack exploration' ? 'exploration' :
      resultAction==='.pack data4' ? 'data4' :
      resultAction==='.pack puzzles' ? 'puzzle3' :
      resultAction==='.pack words3' ? 'word3' :
      resultAction==='.pack lucky' ? 'lucky' :
      resultAction==='.pack brain' ? 'brain' :
      resultAction==='.pack word' ? 'word' :
      resultAction==='.pack numbers' ? 'numbers' :
      resultAction==='.pack logic' ? 'logic' :
      resultAction==='.arena' ? 'arena' :
      action==='.chess' ? (chessContext?.phase==='WAITING'?'chessqueue':chessContext?.phase==='PENDING'?'chesspending':chessContext?.phase==='ACTIVE'?'chessactive':'chess') :
      resultAction==='.queue join snakes' || resultAction==='.queue status' || resultAction==='.match current' || resultAction==='.match accept' || resultAction==='.match roll' ? 'match' :
      resultAction==='.social' ? 'social' :
      resultAction==='.friend' ? 'friends' :
      resultAction==='.duel' ? 'duels' :
      resultAction==='.pay' ? 'transfers' :
      resultAction==='.wow economy' || action==='.vshop' || action==='.craft' || action==='.career' ? 'wowlife' :
      resultAction==='.arcade v' || resultAction==='.slot v' || resultAction==='.risk v help' ? 'varcade' : null;
    if(/^\.chatstyle(?:\s|$)/i.test(text) && !isGroup){
      const out=await sendButtons(jid,'mixed',msg,{panelName:'wowidentityhub',body:response});
      record({type:'panel_attempt',panel:'wowidentityhub',sent:out.sent===true,stage:out.stage??'unknown',at:Date.now()});
      return {ok:true,action:'chatstyle-interactive',command:text};
    }
    if(panel && !jid.endsWith('@g.us')) {
      const out=await sendButtons(jid,'mixed',msg,{panelName:panel,body:response});
      record({type:'panel_attempt',panel,sent:out.sent===true,stage:out.stage??'unknown',at:Date.now()});
    } else if(response) await sendText(jid,response,msg);
    if(parsed.buttonId) record({type:'button_click',source:parsed.source,buttonId:parsed.buttonId,at:Date.now()});
    return {ok:true,action:'command',command:text,source:parsed.source};
  };
}
