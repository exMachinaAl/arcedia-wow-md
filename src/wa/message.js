import {BUTTON_COMMANDS} from './buttons.js';
/** Parse direct messages and reply selections without relying on a button library. */
const MAX_DEPTH=8;
export function unwrap(message) {
  let m=message;
  for(let n=0;n<MAX_DEPTH && m;n++) {
    m=m.ephemeralMessage?.message ?? m.viewOnceMessage?.message ??
      m.viewOnceMessageV2?.message ?? m.viewOnceMessageV2Extension?.message ??
      m.documentWithCaptionMessage?.message ?? m;
    if (!(m?.ephemeralMessage || m?.viewOnceMessage || m?.viewOnceMessageV2 || m?.viewOnceMessageV2Extension || m?.documentWithCaptionMessage)) break;
  }
  return m ?? {};
}
function normalizedId(id) {
  return typeof id==='string' && Object.hasOwn(BUTTON_COMMANDS,id) ? BUTTON_COMMANDS[id] : null;
}
export function parseIncoming(message) {
  if (!message?.message) return null;
  const m=unwrap(message.message);
  const native=m.interactiveResponseMessage?.nativeFlowResponseMessage;
  if(native?.paramsJson) {
    try {
      const obj=JSON.parse(native.paramsJson);
      const id=obj.id ?? obj.selectedId ?? obj.selected_id ?? obj.button_id;
      const mapped=normalizedId(id);
      if(mapped) return {text:mapped,source:'native-button',buttonId:id};
    } catch { /* malformed/untrusted payload ignored */ }
    return null;
  }
  const id=m.buttonsResponseMessage?.selectedButtonId ??
    m.templateButtonReplyMessage?.selectedId ??
    m.listResponseMessage?.singleSelectReply?.selectedRowId;
  if(id) {
    const mapped=normalizedId(id);
    return mapped ? {text:mapped,source:'button-reply',buttonId:id} : null;
  }
  const raw=m.conversation ?? m.extendedTextMessage?.text ?? m.imageMessage?.caption ?? '';
  if(typeof raw!=='string' || raw.length>700) return null; // AI can use up to 500 prompt chars; core still validates game commands
  const text=raw.trim();
  return text.startsWith('.') ? {text,source:'text',buttonId:null} : null;
}
export const getButtonIds = () => Object.keys(BUTTON_COMMANDS);
