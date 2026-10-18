/** Self-hosted Ollama adapter. No paid inference provider, prompt history, or remote endpoint. */
import { inTransaction } from '../db.js';
const fmt = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'});
const schema={type:'object',properties:{title:{type:'string'},answer:{type:'string'},tags:{type:'array',items:{type:'string'}}},required:['title','answer','tags'],additionalProperties:false};
const clean=s=>String(s??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').trim();
export function createAIService(db,{enabled=process.env.WA_AI_ENABLED==='1',model=process.env.WA_AI_MODEL||'llama3.2:3b',url=process.env.WA_AI_URL||'http://127.0.0.1:11434',fetchFn=globalThis.fetch,clock=Date.now,maxConcurrent=2}={}) {
  const origin=new URL(url);
  if(origin.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash) throw Error('WA_AI_URL must point to a local Ollama HTTP service');
  if(!/^[a-zA-Z0-9_.:\/-]{1,90}$/.test(model))throw Error('Invalid WA_AI_MODEL');
  if(!Number.isInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>8)throw Error('Invalid AI concurrency');
  const endpoint=new URL('/api/generate',origin);
  const inflight=new Map();let active=0;
  function preferences(userId) {return db.prepare('SELECT consent FROM ai_preferences WHERE user_id=?').get(userId)?.consent===1;}
  function stats(userId,now){
    const day=fmt.format(new Date(now));
    const count=db.prepare('SELECT COUNT(*) AS n FROM ai_calls WHERE user_id=? AND day=?').get(userId,day).n;
    const minute=db.prepare('SELECT COUNT(*) AS n FROM ai_calls WHERE user_id=? AND created_ms>=?').get(userId,now-60_000).n;
    const tier=db.prepare('SELECT tier FROM users WHERE id=?').get(userId)?.tier??'FREE';
    return {day,count,minute,tier,dailyLimit:tier==='PRIORITY'?100:25,minuteLimit:tier==='PRIORITY'?10:3};
  }
  function ensureUser(id){db.prepare('INSERT OR IGNORE INTO users(id) VALUES(?)').run(id);}
  function storeResponse(userId,eventKey,response,now){
    inTransaction(db,()=>{
      const day=fmt.format(new Date(now));
      const r=db.prepare('INSERT OR IGNORE INTO ai_calls(event_key,user_id,day,created_ms) VALUES(?,?,?,?)').run(eventKey,userId,day,now);
      if(r.changes)db.prepare('INSERT OR IGNORE INTO ai_replies(event_key,user_id,response) VALUES(?,?,?)').run(eventKey,userId,response);
    });
  }
  async function queryOllama(prompt,jsonMode){
    const body={model,stream:false,prompt:jsonMode?
      `Respond only as structured JSON. Provide a short title, concise answer, and up to 3 tags. User question: ${prompt}`:
      `Anda asisten WA-WORLD. Jawab ringkas dalam bahasa Indonesia, maksimal 500 karakter. Jangan meminta informasi pribadi. Pertanyaan: ${prompt}`,
      options:{temperature:0.2,num_predict:200}};
    if(jsonMode)body.format=schema;
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetchFn(endpoint.toString(),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal,redirect:'error'});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const len=Number(response.headers?.get?.('content-length')??0);
      if(len>80_000)throw Error('Response oversized');
      const raw=await response.text();if(raw.length>80_000)throw Error('Response oversized');
      const payload=JSON.parse(raw);if(typeof payload.response!=='string')throw Error('Missing response');
      if(!jsonMode)return clean(payload.response).slice(0,850)||'Model tidak mengembalikan teks.';
      const parsed=JSON.parse(payload.response);
      if(!parsed||typeof parsed.title!=='string'||typeof parsed.answer!=='string'||!Array.isArray(parsed.tags)||parsed.tags.some(t=>typeof t!=='string'))throw Error('Invalid JSON result');
      return JSON.stringify({title:clean(parsed.title).slice(0,80),answer:clean(parsed.answer).slice(0,420),tags:parsed.tags.slice(0,3).map(t=>clean(t).slice(0,24))});
    }finally{clearTimeout(timer);}
  }
  async function perform({senderId,eventKey,text,now=clock()}){
    if(!senderId||!eventKey||senderId.length>180||eventKey.length>350)return 'AI request tidak valid.';
    const parts=clean(text).split(/\s+/);const sub=(parts[1]||'help').toLowerCase();
    ensureUser(senderId);
    if(sub==='help'||sub==='menu')return '🤖 AI lokal WA-WORLD\n.ai status — status & kuota\n.ai consent — izinkan pemrosesan lokal\n.ai ask PERTANYAAN — tanya LLM\n.ai json PERTANYAAN — respons JSON\n.ai off — cabut izin & hapus cache jawaban.\nMode ini hanya bekerja jika server Ollama lokal diaktifkan.';
    if(sub==='status'){
      const s=stats(senderId,now);return `🤖 AI: ${enabled?'ON (model belum tentu siap)':'OFF'} | izin: ${preferences(senderId)?'YA':'BELUM'}\nModel: ${model}\nKuota hari ini: ${s.count}/${s.dailyLimit} · batas per menit ${s.minuteLimit}\nAI self-hosted, tidak memakai API berbayar.`;
    }
    if(sub==='consent'){
      db.prepare('INSERT INTO ai_preferences(user_id,consent) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET consent=1').run(senderId);
      return '✅ Izin AI lokal tersimpan. Pertanyaan akan dikirim hanya ke Ollama di mesin yang menjalankan bot. Gunakan .ai off untuk berhenti.';
    }
    if(sub==='off'){
      inTransaction(db,()=>{
        db.prepare('INSERT INTO ai_preferences(user_id,consent) VALUES(?,0) ON CONFLICT(user_id) DO UPDATE SET consent=0').run(senderId);
        db.prepare('DELETE FROM ai_replies WHERE user_id=?').run(senderId);
      });
      return '🔒 AI dimatikan untuk akun Anda dan cache jawabannya dihapus. Statistik pemakaian tetap disimpan tanpa prompt.';
    }
    if(!['ask','json'].includes(sub))return 'Gunakan .ai help untuk daftar perintah.';
    const prompt=clean(text.split(/\s+/).slice(2).join(' '));
    if(prompt.length<3||prompt.length>500)return 'Pertanyaan wajib 3–500 karakter. Contoh: .ai ask Apa itu algoritma?';
    if(!enabled)return '🤖 AI lokal belum diaktifkan server. Admin: instal Ollama dan atur WA_AI_ENABLED=1 serta WA_AI_MODEL.';
    if(!preferences(senderId))return '🔒 Aktifkan izin lebih dulu dengan .ai consent. Prompt hanya diproses di Ollama lokal.';
    const previous=db.prepare('SELECT response FROM ai_replies WHERE event_key=? AND user_id=?').get(eventKey,senderId);
    if(previous)return previous.response;
    if(inflight.has(eventKey))return inflight.get(eventKey);
    const s=stats(senderId,now);
    if(s.count>=s.dailyLimit||s.minute>=s.minuteLimit)return '⏳ Kuota AI saat ini tercapai. Semua fitur tetap gratis; coba lagi nanti.';
    if(active>=maxConcurrent)return '⏳ AI sedang sibuk. Coba lagi sebentar; permintaan tidak dihitung.';
    const job=(async()=>{
      active++;
      try{
        const answer=await queryOllama(prompt,sub==='json');
        // Consent may have been revoked while inference was running.
        if(!preferences(senderId))return '🔒 AI dihentikan karena izin dicabut.';
        const final=`🤖 ${sub==='json'?'JSON':'WA-WORLD AI'}\n${answer}`;
        storeResponse(senderId,eventKey,final,now);
        return final;
      }catch(error){return `⚠️ Model lokal belum merespons (${String(error.name==='AbortError'?'timeout':error.message).slice(0,75)}). Periksa Ollama/model. Kuota tidak terpakai.`;}
      finally{active--;inflight.delete(eventKey);}
    })();
    inflight.set(eventKey,job);return job;
  }
  return {perform,stats,preferences};
}
