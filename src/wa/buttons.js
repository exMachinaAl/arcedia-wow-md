/**
 * WA-WORLD native button experiment (Baileys / unofficial WhatsApp Web transport).
 * A successful relay means "submitted", NOT "visible on recipient device".
 * Keep text alternatives in the SAME message instead of sending a separate fake menu.
 */
export const BUTTONS=Object.freeze([
  {id:'waw:menu',title:'🏠 Menu',command:'.menu'},
  {id:'waw:games',title:'🎮 Games',command:'.games'},
  {id:'waw:wallet',title:'💰 Wallet',command:'.wallet'}
]);

/** Real native quick-reply panels: unique IDs mapped through an explicit allowlist. */
export const PANELS=Object.freeze({
  home: Object.freeze({title:'WA-WORLD Beranda',buttons:[
    {id:'waw:games',title:'🎮 Games',command:'.games'},
    {id:'waw:daily',title:'🎁 Daily',command:'.daily'},
    {id:'waw:profile',title:'👤 Profil',command:'.profile'}]}),
  games: Object.freeze({title:'WA-WORLD Game Hub',buttons:[
    {id:'waw:coin',title:'🪙 Koin',command:'.coin'},
    {id:'waw:rps',title:'✊ Suit',command:'.rps'},
    {id:'waw:guess',title:'🔢 Tebak Angka',command:'.guess start'}]}),
  coin: Object.freeze({title:'Lempar Koin',buttons:[
    {id:'waw:coin:kepala',title:'🪙 Kepala',command:'.coin kepala'},
    {id:'waw:coin:ekor',title:'🪙 Ekor',command:'.coin ekor'},
    {id:'waw:menu',title:'🏠 Beranda',command:'.menu'}]}),
  rps: Object.freeze({title:'Batu Gunting Kertas',buttons:[
    {id:'waw:rps:batu',title:'✊ Batu',command:'.rps batu'},
    {id:'waw:rps:gunting',title:'✌️ Gunting',command:'.rps gunting'},
    {id:'waw:rps:kertas',title:'🖐️ Kertas',command:'.rps kertas'}]}),
  packs: Object.freeze({title:'WA-WORLD Game Packs',buttons:[
    {id:'waw:pack:lucky',title:'🎲 Lucky',command:'.pack lucky'},
    {id:'waw:pack:brain',title:'🧠 Brain',command:'.pack brain'},
    {id:'waw:pack:word',title:'🔤 Word',command:'.pack word'}]}),
  lucky: Object.freeze({title:'Lucky Pack',buttons:[
    {id:'waw:dice',title:'🎲 Dadu',command:'.dice 4'},
    {id:'waw:parity',title:'🔢 Genap',command:'.parity genap'},
    {id:'waw:highlow',title:'🃏 Naik',command:'.highlow naik'}]}),
  brain: Object.freeze({title:'Brain Pack',buttons:[
    {id:'waw:math',title:'➕ Math',command:'.math start'},
    {id:'waw:trivia',title:'🧩 Trivia',command:'.trivia start'},
    {id:'waw:pattern',title:'🔢 Pola',command:'.pattern start'}]}),
  word: Object.freeze({title:'Word Pack',buttons:[
    {id:'waw:scramble',title:'🔤 Susun',command:'.scramble start'},
    {id:'waw:hangman',title:'🔡 Huruf',command:'.hangman start'},
    {id:'waw:chain',title:'🔗 Sambung',command:'.chain start'}]}),
  profile: Object.freeze({title:'WA-WORLD Profil',buttons:[
    {id:'waw:wallet',title:'💰 Dompet',command:'.wallet'},
    {id:'waw:rank',title:'🏆 Rank',command:'.rank'},
    {id:'waw:menu',title:'🏠 Beranda',command:'.menu'}]})
});
export const BUTTON_COMMANDS=Object.freeze(Object.fromEntries(
  [...BUTTONS,...Object.values(PANELS).flatMap(p=>p.buttons)].map(b=>[b.id,b.command])
));
export function resolvePanel(name){return PANELS[name]??null;}
function choiceText(panel){return panel.buttons.map((b,i)=>`${i+1}. ${b.title}: ${b.command}`).join('\n');}

export function fallbackText(mode='text',panelName=null) {
  const panel=resolvePanel(panelName);
  if(panel) return `🌍 *${panel.title}*\n${choiceText(panel)}\n\nJika tombol tidak tampil, ketik perintah di atas.\n.menu = beranda.`;
  return `🌍 *WA-WORLD Button Lab* [${mode}]\n`+
    `1. Menu: .tap 1\n2. Games: .tap 2\n3. Wallet: .tap 3\n\n`+
    `Jika tombol asli tidak muncul, ketik perintah di atas.\n`+
    `Laporkan dengan .buttoncheck native hidden atau .buttoncheck native shown.`;
}
export function tapCommand(input) {
  return ({'1':'.menu','2':'.games','3':'.wallet'}[String(input??'').trim().toLowerCase()] ?? null);
}
export function buttonCheck(value) {
  const v=String(value??'').trim().toLowerCase();
  return ['shown','hidden','clicked'].includes(v)?v:null;
}
export function legacyPayload({panelName=null,body=null}={}) {
  const buttons=resolvePanel(panelName)?.buttons??BUTTONS;
  return {text:body?`${body}\n\n${fallbackText('legacy',panelName)}`:fallbackText('legacy',panelName),footer:'WA-WORLD • legacy (eksperimental)',
    buttons:buttons.map(b=>({buttonId:b.id,buttonText:{displayText:b.title},type:1})),headerType:1};
}
/** Protobuf payload stays OUTSIDE viewOnce; some clients hid the buttons when viewOnce wrapped it. */
export function nativePayload(proto,{panelName=null,body=null}={}) {
  if(!proto?.Message?.InteractiveMessage) throw Error('Baileys InteractiveMessage protobuf unavailable');
  const IM=proto.Message.InteractiveMessage;
  const panel=resolvePanel(panelName);
  const buttons=(panel?.buttons??BUTTONS).map(b=>({name:'quick_reply',buttonParamsJson:JSON.stringify({display_text:b.title,id:b.id})}));
  return {
    interactiveMessage:IM.create({
      header:IM.Header.create({title:panel?.title??'WA-WORLD',hasMediaAttachment:false}),
      body:IM.Body.create({text:body?`${body}\n\n${fallbackText('native',panelName)}`.slice(0,1000):fallbackText('native',panelName)}),
      footer:IM.Footer.create({text:'WA-WORLD • quick-reply experimental'}),
      nativeFlowMessage:IM.NativeFlowMessage.create({buttons,messageVersion:1})
    })
  };
}
/**
 * Business relay metadata used for ordinary quick replies, not payments or checkout.
 * Structural compatibility with some WhatsApp clients is experimental and can change.
 */
export function nativeRelayNodes(jid,nowSeconds=Math.floor(Date.now()/1000)) {
  if(!jid || typeof jid!=='string') throw Error('Invalid recipient JID');
  const biz={tag:'biz',attrs:{actual_actors:'2',host_storage:'2',privacy_mode_ts:String(Math.max(0,nowSeconds-77980457))},content:[
    {tag:'interactive',attrs:{type:'native_flow',v:'1'},content:[{tag:'native_flow',attrs:{v:'9',name:'mixed'}}]}
  ]};
  if(jid.endsWith('@g.us')) return [biz];
  return [biz,{tag:'bot',attrs:{biz_bot:'1'}}];
}
export async function sendButtonExperiment({sock,jid,mode,quoted,baileys,panelName=null,body=null}) {
  if(mode==='text') {
    await sock.sendMessage(jid,{text:body?`${body}\n\n${fallbackText('text',panelName)}`:fallbackText('text',panelName)},{quoted});
    return {transport:'text',attempted:false,sent:true,stage:'text-sent'};
  }
  try {
    if(mode==='legacy') {
      await sock.sendMessage(jid,legacyPayload({panelName,body}),{quoted});
    } else if(mode==='native') {
      const {proto,generateWAMessageFromContent}=baileys??{};
      if(typeof generateWAMessageFromContent!=='function') throw Error('Baileys generateWAMessageFromContent unavailable');
      if(typeof sock.relayMessage!=='function') throw Error('Socket relayMessage unavailable');
      const outgoing=generateWAMessageFromContent(jid,nativePayload(proto,{panelName,body}),{userJid:sock.user?.id,quoted});
      if(!outgoing?.key?.id || !outgoing?.message) throw Error('Baileys message generator returned invalid message');
      await sock.relayMessage(jid,outgoing.message,{
        messageId:outgoing.key.id,
        additionalNodes:nativeRelayNodes(jid)
      });
    } else throw Error('Unknown button mode');
    // Never claim the user actually saw the button: only the client can confirm rendering.
    return {transport:mode,attempted:true,sent:true,stage:'relayed-unverified'};
  } catch(error) {
    const details=String(error?.message??error).slice(0,120);
    // Fallback only when the transport fails. Do not simulate visual button UI.
    try {await sock.sendMessage(jid,{text:`⚠️ Tombol ${mode} gagal dikirim.\n\n${body?body+'\n\n':''}${fallbackText('text',panelName)}`},{quoted});}
    catch { /* original error remains available for terminal diagnostics */ }
    return {transport:mode,attempted:true,sent:false,stage:'relay-failed',error:details};
  }
}
