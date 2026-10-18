/** Translate real WhatsApp group recipient receipts into delivery evidence.
 * A server ACK or returned sendMessage() is never sufficient to authorize revoke.
 * Never accept an unrelated message key or missing recipient receipt.
 */
export function groupReceiptToDelivery(update){
 const key=update?.key,receipt=update?.receipt;
 if(!key?.id || !key?.fromMe || !key?.remoteJid?.endsWith('@g.us') || !receipt)return null;
 if(receipt.playedTimestamp!=null || receipt.readTimestamp!=null)return {key,status:4};
 if(receipt.receiptTimestamp!=null)return {key,status:3};
 return null;
}
