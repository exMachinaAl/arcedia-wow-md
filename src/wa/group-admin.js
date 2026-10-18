/** Bot group-admin verification against identities supplied by WhatsApp itself. */
const normalize=x=>String(x??'').replace(/:\d+(?=@)/,'');
export function isVerifiedBotGroupAdmin(user,participants){
 const ids=new Set([user?.id,user?.lid,user?.phoneNumber,user?.pn].filter(Boolean).map(normalize));
 if(!ids.size || !Array.isArray(participants))return false;
 return participants.some(p=>['admin','superadmin'].includes(p.admin) &&
   [p.id,p.lid,p.phoneNumber,p.pn].filter(Boolean).map(normalize).some(id=>ids.has(id)));
}
