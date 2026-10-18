/** Preserve the original incoming key; never fabricate participant identity. */
export function originalGroupMessageKey(key){
 if(!key || key.fromMe!==false || typeof key.id!=='string' || !key.id || key.id.length>160 ||
    typeof key.remoteJid!=='string' || !key.remoteJid.endsWith('@g.us') ||
    typeof key.participant!=='string' || !key.participant.includes('@'))return null;
 // Only the four protocol fields required for a revoke are persisted.
 return {remoteJid:key.remoteJid,fromMe:false,id:key.id,participant:key.participant};
}
export function restoreGroupMessageKey(stored,group,sourceId,participant){
 if(stored){try{const key=originalGroupMessageKey(JSON.parse(stored));
  if(key?.remoteJid===group && key.id===sourceId)return key;
 }catch{/* malformed legacy record */}}
 // Keep older jobs compatible; existing protection against expired ACK remains.
 return originalGroupMessageKey({remoteJid:group,fromMe:false,id:sourceId,participant});
}
