/** v3.2 opt-in group button probe. No bulk sends, no untrusted group actions. */
import {buttonCheck} from './buttons.js';
export function createGroupButtonLab({enabled=false,now=()=>Date.now(),cooldownMs=60000}={}){
 const last=new Map();
 async function handle({jid,sender,text,groupAdmin=false,sendText,sendButtons,record=()=>{},quoted}){
  if(!jid?.endsWith('@g.us')||!sender)return {ignored:'not-group'};
  const parts=String(text).trim().toLowerCase().split(/\s+/);
  if(parts[0]!=='.groupbuttons')return null;
  const sub=parts[1]??'status';
  if(sub==='report'){
   const value=buttonCheck(parts[2]);
   if(!value){await sendText(jid,'Gunakan .groupbuttons report shown|hidden|clicked',quoted);return {ok:false};}
   record({type:'button_feedback',mode:'group',outcome:value,at:now()});
   await sendText(jid,`🧾 Terima kasih. Feedback tombol grup: ${value}. Tidak dianggap bukti universal untuk perangkat lain.`,quoted);
   return {ok:true,action:'group-buttons-feedback'};
  }
  if(!groupAdmin){await sendText(jid,'⛔ Perintah Group Button Lab hanya untuk admin grup terverifikasi.',quoted);return {ok:false};}
  if(sub==='status'){await sendText(jid,`🧪 Group Button Lab: ${enabled?'READY (admin-only)':'OFF'}\n.groupbuttons probe | selector | mixed\n.groupbuttons report shown|hidden|clicked\nTampilan nyata harus diverifikasi dari ponsel.`,quoted);return {ok:true};}
  if(!['probe','selector','mixed'].includes(sub)){await sendText(jid,'Gunakan .groupbuttons status|probe|selector|mixed',quoted);return {ok:false};}
  if(!enabled){await sendText(jid,'🔒 Uji tombol grup OFF. Admin server set WOW_GROUP_BUTTONS_PROBE=true di .env dan restart.',quoted);return {ok:false};}
  const t=now(),previous=last.get(jid)??0;
  if(t-previous<cooldownMs){await sendText(jid,'⏳ Cooldown uji tombol grup 60 detik. Gunakan menu teks dahulu.',quoted);return {ok:false,reason:'rate-limit'};}
  last.set(jid,t);
  const mode=sub==='selector'?'selector':sub==='mixed'?'mixed':'native';
  const result=await sendButtons(jid,mode,quoted,{panelName:'groupdemo',body:'🧪 Uji tampilan grup.\nMode mixed: 3 quick-reply + 1 selector berisi 8 pilihan.\nJika tombol tidak tampil, ketik .menu atau .games. Laporkan dengan .groupbuttons report hidden.'});;
  record({type:'button_attempt',mode:sub==='selector'?'group-selector':sub==='mixed'?'group-mixed':'group-native',sent:result.sent===true,stage:result.stage??'unknown',at:t});
  return {ok:true,action:'group-button-probe',mode,...result};
 }
 return {handle};
}
