import { parseIncoming } from './message.js';
import {tapCommand,buttonCheck} from './buttons.js';
/** Stateless message orchestration; real UI rendering is confirmed only by receiver testing. */
export function createWhatsAppHandler({core,sendText,sendButtons,record=()=>{},allowGroups=false,allowSender=()=>true}) {
  if(!core || typeof sendText!=='function' || typeof sendButtons!=='function') throw Error('Invalid handler dependencies');
  return async function handle(msg) {
    const jid=msg?.key?.remoteJid;
    if(!jid || msg.key.fromMe || jid==='status@broadcast' || jid.endsWith('@broadcast')) return {ignored:'outgoing/status'};
    if(jid.endsWith('@g.us') && !allowGroups) return {ignored:'group-disabled'};
    if(!allowSender(msg.key.participant ?? jid,jid)) return {ignored:'not-allowed'};
    if(typeof msg.key.id!=='string' || !msg.key.id || msg.key.id.length>160) return {ignored:'missing-id'};
    const parsed=parseIncoming(msg);
    if(!parsed) return {ignored:'not-command'};
    const sender=msg.key.participant ?? jid;
    const eventKey=`wa:${jid}:${msg.key.id}:${sender}`;
    const cmd=parsed.text.trim();
    const parts=cmd.split(/\s+/);
    const action=parts[0].toLowerCase();
    if(action==='.buttons' || action==='.testbuttons') {
      if(jid.endsWith('@g.us')) {await sendText(jid,'Uji tombol hanya tersedia di chat pribadi.',msg);return {ok:true};}
      const mode=(parts[1]??'native').toLowerCase();
      if(!['text','legacy','native'].includes(mode)) {
        await sendText(jid,'Gunakan .buttons native | .buttons legacy | .buttons text',msg);
        return {ok:true};
      }
      const result=await sendButtons(jid,mode,msg);
      record({type:'button_attempt',mode,sent:result.sent===true,stage:result.stage??'unknown',at:Date.now()});
      return {ok:true,action:'send-buttons',mode,...result};
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
    const response=core.process({senderId:sender,eventKey,text});
    // Core response is recorded before attempting delivery; text fallback is included in the native payload.
    const resultAction=text.trim().toLowerCase();
    const panel = resultAction==='.menu'||resultAction==='.help'||resultAction==='.start' ? 'home' :
      resultAction==='.games'||resultAction==='.play' ? 'games' :
      resultAction==='.profile' ? 'profile' :
      resultAction==='.coin' ? 'coin' :
      resultAction==='.rps' ? 'rps' :
      resultAction==='.packs' ? 'packs' :
      resultAction==='.pack lucky' ? 'lucky' :
      resultAction==='.pack brain' ? 'brain' :
      resultAction==='.pack word' ? 'word' : null;
    if(panel && !jid.endsWith('@g.us')) {
      const out=await sendButtons(jid,'native',msg,{panelName:panel,body:response});
      record({type:'panel_attempt',panel,sent:out.sent===true,stage:out.stage??'unknown',at:Date.now()});
    } else if(response) await sendText(jid,response,msg);
    if(parsed.buttonId) record({type:'button_click',source:parsed.source,buttonId:parsed.buttonId,at:Date.now()});
    return {ok:true,action:'command',command:text,source:parsed.source};
  };
}
