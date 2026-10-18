/** WA-WORLD WhatsApp Gateway - Baileys unofficial Web multi-device adapter. */
import {resolve} from 'node:path';
import {openDatabase} from '../db.js';
import {createCore} from '../core.js';
import {createAIService} from '../ai/engine.js';
import {createWhatsAppHandler} from './handler.js';
import {createChessNotifier} from './chess-notifier.js';
import {createBlackjackNotifier} from './blackjack-notifier.js';
import {createRuntime} from '../runtime.js';
import {sendButtonExperiment} from './buttons.js';
import {loadConfig} from './config.js';
import {groupReceiptToDelivery} from './receipt.js';
import {isVerifiedBotGroupAdmin} from './group-admin.js';
import {createChatIdentity} from './chat-identity.js';
import {recordButtonEvent,setWaStatus} from './telemetry.js';
let baileys, pino, qrterm;
try {
  baileys=await import('@whiskeysockets/baileys');
  pino=(await import('pino')).default;
  qrterm=(await import('qrcode-terminal')).default;
}catch(error) {
  console.error('Baileys belum siap. Jalankan npm install dari folder WA-WORLD.');
  console.error(String(error.message).slice(0,250));
  process.exit(1);
}
const makeWASocket=baileys.default;
const {useMultiFileAuthState,DisconnectReason}=baileys;
const config=loadConfig();
const db=openDatabase();
const core=createCore(db);
const chatIdentity=createChatIdentity({db});
chatIdentity.purge();
const ambiguous=chatIdentity.recover();
if(ambiguous)console.warn(`WOW Chat: ${ambiguous} pesan sedang dikirim saat crash ditandai AMBIGUOUS (tidak dikirim ulang otomatis).`);
const runtime=createRuntime(db);
const resumed=runtime.start();
console.log(`💾 DB recovery: ${resumed.previous}, waktu offline ${Math.floor(resumed.pausedMs/1000)} detik; batas match dijeda saat offline.`);
const aiService=createAIService(db);
const logger=pino({level:'silent'});
let sock=null;
let stopped=false;
let retry=null;
let generation=0;
let attempts=0;
let isConnected=false;
const notifier=createChessNotifier({
  core,isConnected:()=>isConnected && !!sock && !stopped,
  sendText:(jid,text)=>sock.sendMessage(jid,{text}),
  sendImage:(jid,image,caption)=>sock.sendMessage(jid,{image,mimetype:'image/png',caption}),
  log:(stage,reason)=>console.warn('Chess notification',stage,String(reason).slice(0,120))
});
async function flushChessNotices(){try{await notifier.flush();}catch(error){console.warn('Chess notifier:',String(error.message).slice(0,140));}}
// Periodic scanning also handles reconnects and timeouts without requiring a new incoming chat message.
const bjNotifier=createBlackjackNotifier({core,isConnected:()=>isConnected&&!!sock&&!stopped,
  sendText:(jid,text)=>sock.sendMessage(jid,{text}),
  sendCard:async(jid)=>{const card=core.getBlackjackImage?.({senderId:jid});if(card)await sock.sendMessage(jid,{image:card.png,mimetype:'image/png',caption:card.caption});},
  sendControls:async(jid)=>{const ctx=core.getBlackjackContext?.({senderId:jid});const panelName=ctx?.phase==='ACTIVE'?'bjplay':ctx?.phase==='LOBBY'?'bjlobby':'blackjack';
    await sendButtonExperiment({sock,jid,mode:'mixed',baileys,panelName,body:'🃏 Pilih tindakan Blackjack berikutnya. Anda tidak perlu mengetik perintah.'});},
  log:(stage,reason)=>console.warn('Blackjack notice',stage,String(reason).slice(0,120))});
const pending=new Set();
const earlyAcks=new Map(); // short-lived confirmations arriving before sendMessage() resolves
const ackId=(jid,id)=>`${jid}:${id}`;
function onChatReceipt(key,status){
 const changed=chatIdentity.ackDelivered(key,status);
 if(!changed && key?.fromMe && key?.remoteJid?.endsWith('@g.us') && key?.id && Number.isInteger(status) && status>=3 && status<=5){
  earlyAcks.set(ackId(key.remoteJid,key.id),Date.now());
  if(earlyAcks.size>80){const first=earlyAcks.keys().next().value;earlyAcks.delete(first);}
 }
}
function normalizeJid(x){return String(x??'').replace(/:\d+(?=@)/,'');}
async function botIsGroupAdmin(groupId){
 if(!sock||!isConnected)return false;
 try{
  const members=(await sock.groupMetadata(groupId))?.participants??[];
  return isVerifiedBotGroupAdmin(sock.user,members);
 }catch(err){console.warn('WOW Replace moderation check:',String(err.message).slice(0,100));return false;}
}
let chatFlushBusy=false;
function track(p){pending.add(p);void p.finally(()=>pending.delete(p));return p;}
async function flushNotices(){await flushChessNotices();await bjNotifier.flush();}
const chatCleanTimer=setInterval(()=>{if(!stopped)try{chatIdentity.purge();}catch(e){console.warn('WOW Chat retention:',e.message);}},6*3600000);
chatCleanTimer.unref?.();
const chatTimer=setInterval(()=>{
  if(stopped||!isConnected||chatFlushBusy||!sock)return;
  chatFlushBusy=true;
  track((async()=>{
    const job=chatIdentity.claim();
    if(!job)return;
    try{
      const result=await sock.sendMessage(job.group_id,{text:job.text,mentions:job.mentions});
      chatIdentity.finish(job.source_key,true,result?.key?.id??'');
      const key=result?.key;
      if(key?.id && earlyAcks.has(ackId(job.group_id,key.id))){onChatReceipt({...key,remoteJid:job.group_id,fromMe:true},3);earlyAcks.delete(ackId(job.group_id,key.id));}
    }catch(error){
      chatIdentity.finish(job.source_key,false,String(error.message).slice(0,120));
      console.warn('WOW Chat delivery:',String(error.message).slice(0,100));
    }
  })().catch(e=>console.error('WOW Chat queue:',e.message)).finally(()=>{chatFlushBusy=false;}));
},1500);
chatTimer.unref?.();
let deleteBusy=false;
const deleteTimer=setInterval(()=>{
 if(stopped||!isConnected||!sock||deleteBusy)return;
 deleteBusy=true;
 track((async()=>{
  const job=chatIdentity.claimDelete();
  if(!job)return;
  // Independent of sender group admin: BOT itself must be a verified group admin.
  if(!(await botIsGroupAdmin(job.group_id))){chatIdentity.skipDelete(job.source_key,'bot-not-verified-admin');return;}
  // Recheck after asynchronous metadata lookup: admin/player may have turned it OFF meanwhile.
  if(!chatIdentity.stillAllowedDelete(job.source_key)){chatIdentity.skipDelete(job.source_key,'policy-revoked-after-check');return;}
  try{
   // This requests a WhatsApp revoke. It cannot prove removal from every recipient screen.
   await sock.sendMessage(job.group_id,{delete:job.key});
   chatIdentity.finishDelete(job.source_key,true);
  }catch(err){chatIdentity.finishDelete(job.source_key,false,String(err.message));console.warn('WOW Chat revoke failed:',String(err.message).slice(0,100));}
 })().catch(e=>console.error('WOW Chat safe-replace:',e.message)).finally(()=>{deleteBusy=false;}));
},1200);
deleteTimer.unref?.();

const noticeTimer=setInterval(()=>{track(flushNotices().catch(e=>console.warn('Outbox:',String(e.message).slice(0,120))));},8000);
// v2.3: resume auction escrow settlement after downtime, independent of incoming messages.
// No new auctions can be opened unless explicitly enabled; historic escrow is always reconciled.
function sweepMarket(){if(stopped)return;try{const r=core.sweepAuctions({now:Date.now(),limit:40});if(r.processed)console.log(`Auction recovery: ${r.processed} closed (${r.settled} sold, ${r.returned} returned)`);}catch(e){console.error('Auction recovery:',String(e.message).slice(0,140));}}
sweepMarket();
const auctionSweepTimer=setInterval(sweepMarket,60000);
auctionSweepTimer.unref?.();
const heartbeatTimer=setInterval(()=>{if(!stopped)try{runtime.heartbeat();}catch(error){console.error('FATAL gateway lease:',error.message);void shutdown().finally(()=>process.exit(1));}},5000);
noticeTimer.unref?.();
heartbeatTimer.unref?.();
// Avoid processing parallel messages for the same account; core's ledger is idempotent for repeated message IDs.
const active=new Set();
function mask(value){return String(value??'').replace(/[0-9](?=[0-9]{3})/g,'•').slice(0,50);}
function scheduleReconnect() {
  if(stopped || retry) return;
  attempts++;
  const delay=Math.min(30000,Math.pow(2,Math.min(attempts,5))*1000);
  console.log(`Reconnecting in ${delay/1000}s (${attempts})...`);
  retry=setTimeout(()=>{retry=null;void connect().catch(e=>console.error('Reconnect error:',e.message));},delay);
}
async function connect() {
  if(stopped)return;
  const gen=++generation;
  const {state,saveCreds}=await useMultiFileAuthState(config.session);
  const current=makeWASocket({auth:state,logger,markOnlineOnConnect:false,syncFullHistory:false});
  sock=current;
  setWaStatus({connection:'connecting'});
  current.ev.on('creds.update',saveCreds);
  current.ev.on('connection.update',({connection,qr,lastDisconnect})=>{
    if(gen!==generation || stopped)return;
    if(qr){console.log('\nScan QR: WhatsApp → Perangkat Tertaut → Tautkan Perangkat');qrterm.generate(qr,{small:true});setWaStatus({connection:'qr-pending'});}
    if(connection==='open'){isConnected=true;attempts=0;setWaStatus({connection:'connected'});console.log('✅ Baileys terhubung. Chess live notification outbox aktif.');track(flushNotices().catch(e=>console.warn(e.message)));}
    if(connection==='close'){isConnected=false;
      setWaStatus({connection:'disconnected',message:'Connection closed; reconnect policy applies.'});
      const code=lastDisconnect?.error?.output?.statusCode;
      if(code===DisconnectReason.loggedOut){console.error('Akun logout. Hapus sesi auth secara manual HANYA setelah memutus tautan pada WhatsApp.');setWaStatus({connection:'logged-out'});return;}
      if(typeof current.end==='function') try{current.end(undefined);}catch{/*ignore*/}
      scheduleReconnect();
    }
  });
  // Baileys versions differ: group members may appear as @lid although DM uses
  // a phone JID. Resolve only verifiable participant links from group metadata.
  // Cache for a short time per group so this never performs one lookup per chat.
  const groupIdentityCache=new Map();
  async function enrichGroupIdentity(message){
    const jid=message?.key?.remoteJid,raw=message?.key?.participant;
    if(!jid?.endsWith('@g.us') || !raw?.endsWith('@lid') || message.key.participantAlt || message.key.fromMe)return;
    const t=Date.now();let cached=groupIdentityCache.get(jid);
    if(!cached || t-cached.at>60_000){
      try {cached={at:t,people:(await current.groupMetadata(jid))?.participants??[]};}
      catch {cached={at:t,people:[]};}
      groupIdentityCache.set(jid,cached);
      if(groupIdentityCache.size>64)groupIdentityCache.delete(groupIdentityCache.keys().next().value);
    }
    const member=cached.people.find(x=>[x.id,x.lid].filter(Boolean).map(normalizeJid).includes(normalizeJid(raw)));
    const pn=[member?.phoneNumber,member?.pn,member?.id].find(x=>typeof x==='string'&&x.endsWith('@s.whatsapp.net'));
    if(pn)message.key.participantAlt=normalizeJid(pn);
  }
  const handle=createWhatsAppHandler({
    core,aiService,chatIdentity,groupButtonsEnabled:config.groupButtonsEnabled,allowGroups:config.allowGroups,allowSender:config.allowSender,record:recordButtonEvent,
    getBotGroupAdmin:async(jid)=>botIsGroupAdmin(jid),
    getGroupAdmin:async(jid,sender)=>{
      try{
        const metadata=await current.groupMetadata(jid);
        const participant=metadata?.participants?.find(x=>[x.id,x.lid,x.phoneNumber].filter(Boolean).map(normalizeJid).includes(normalizeJid(sender)));
        return participant?.admin==='admin'||participant?.admin==='superadmin';
      }catch(error){console.warn('Group admin verification failed:',String(error.message).slice(0,100));return false;}
    },
    sendText:async(jid,text,quoted)=>current.sendMessage(jid,{text},{quoted}),
    sendImage:async(jid,bytes,caption,quoted)=>current.sendMessage(jid,{image:bytes,mimetype:'image/png',caption},{quoted}),
    sendButtons:async(jid,mode,quoted,opts={})=>sendButtonExperiment({sock:current,jid,mode,quoted,baileys,...opts})
  });
  current.ev.on('messages.update',updates=>{
    if(gen!==generation||stopped)return;
    for(const u of updates??[]){
      const status=u?.update?.status;
      if(u?.key && Number.isInteger(status))onChatReceipt(u.key,status);
    }
  });
  // In groups delivery acknowledgements commonly arrive here, not in messages.update.
  current.ev.on('message-receipt.update',updates=>{
    if(gen!==generation||stopped)return;
    for(const u of updates??[]){const delivered=groupReceiptToDelivery(u);if(delivered)onChatReceipt(delivered.key,delivered.status);}
  });
  current.ev.on('messages.upsert',({messages,type})=>{
    track((async()=>{
    if(gen!==generation || stopped || type!=='notify')return;
    for(const msg of messages){
      const jid=msg.key?.remoteJid;
      const id=msg.key?.id;
      if(!jid || !id || id.length>160)continue;
      const key=`${jid}:${id}`;
      if(active.has(key))continue;
      active.add(key);
      try{await enrichGroupIdentity(msg);await handle(msg);await flushNotices();}catch(error){console.error('Handler failure for',mask(jid),String(error.message).slice(0,150));}
      finally{active.delete(key);}
    }
    })().catch(e=>console.error('Unhandled message:',e.message)));
  });
}
async function shutdown(){
  if(stopped)return;stopped=true;generation++;isConnected=false;clearInterval(noticeTimer);clearInterval(heartbeatTimer);clearInterval(auctionSweepTimer);clearInterval(chatTimer);clearInterval(deleteTimer);clearInterval(chatCleanTimer);
  if(retry)clearTimeout(retry);
  setWaStatus({connection:'stopped'});
  // Complete in-flight work before closing SQLite. Messages already committed remain safe
  // even if Windows forces termination; outboxes are replayed at next startup.
  const timeout=new Promise(resolve=>setTimeout(resolve,10000));
  await Promise.race([Promise.allSettled([...pending]),timeout]);
  try {sock?.end?.(undefined);} catch {/*ignore*/}
  try{runtime.stop();}finally{db.close();}
}
process.once('SIGINT',()=>{void shutdown().finally(()=>process.exit(0));});
process.once('SIGTERM',()=>{void shutdown().finally(()=>process.exit(0));});
console.log(`WA-WORLD WhatsApp Gateway v3.3.0 interactive DM + blackjack cards + group revoke diagnostics • groups=${config.allowGroups?'on':'off'} • allowlist=${config.allowCount?'set':'open to incoming command requests'}`);
console.log('WARNING: Baileys is not the official WhatsApp Business Platform. Use dedicated test account and no bulk messaging.');
await connect();
