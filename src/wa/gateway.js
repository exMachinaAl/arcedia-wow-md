/** WA-WORLD WhatsApp Gateway - Baileys unofficial Web multi-device adapter. */
import {resolve} from 'node:path';
import {openDatabase} from '../db.js';
import {createCore} from '../core.js';
import {createWhatsAppHandler} from './handler.js';
import {sendButtonExperiment} from './buttons.js';
import {loadConfig} from './config.js';
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
const logger=pino({level:'silent'});
let sock=null;
let stopped=false;
let retry=null;
let generation=0;
let attempts=0;
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
    if(connection==='open'){attempts=0;setWaStatus({connection:'connected'});console.log('✅ Baileys terhubung. Kirim .menu atau .buttons native dari WhatsApp lain untuk uji.');}
    if(connection==='close'){
      setWaStatus({connection:'disconnected',message:'Connection closed; reconnect policy applies.'});
      const code=lastDisconnect?.error?.output?.statusCode;
      if(code===DisconnectReason.loggedOut){console.error('Akun logout. Hapus sesi auth secara manual HANYA setelah memutus tautan pada WhatsApp.');setWaStatus({connection:'logged-out'});return;}
      if(typeof current.end==='function') try{current.end(undefined);}catch{/*ignore*/}
      scheduleReconnect();
    }
  });
  const handle=createWhatsAppHandler({
    core,allowGroups:config.allowGroups,allowSender:config.allowSender,record:recordButtonEvent,
    sendText:async(jid,text,quoted)=>current.sendMessage(jid,{text},{quoted}),
    sendButtons:async(jid,mode,quoted,opts={})=>sendButtonExperiment({sock:current,jid,mode,quoted,baileys,...opts})
  });
  current.ev.on('messages.upsert',async({messages,type})=>{
    if(gen!==generation || stopped || type!=='notify')return;
    for(const msg of messages){
      const jid=msg.key?.remoteJid;
      const id=msg.key?.id;
      if(!jid || !id || id.length>160)continue;
      const key=`${jid}:${id}`;
      if(active.has(key))continue;
      active.add(key);
      try{await handle(msg);}catch(error){console.error('Handler failure for',mask(jid),String(error.message).slice(0,150));}
      finally{active.delete(key);}
    }
  });
}
async function shutdown(){
  if(stopped)return;stopped=true;generation++;
  if(retry)clearTimeout(retry);
  setWaStatus({connection:'stopped'});
  try {sock?.end?.(undefined);} catch {/*ignore*/}
  db.close();
}
process.once('SIGINT',()=>{void shutdown().finally(()=>process.exit(0));});
process.once('SIGTERM',()=>{void shutdown().finally(()=>process.exit(0));});
console.log(`WA-WORLD WhatsApp Gateway v0.5.0 • groups=${config.allowGroups?'on':'off'} • allowlist=${config.allowCount?'set':'open to incoming command requests'}`);
console.log('WARNING: Baileys is not the official WhatsApp Business Platform. Use dedicated test account and no bulk messaging.');
await connect();
