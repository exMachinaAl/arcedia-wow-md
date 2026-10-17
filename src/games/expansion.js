/** WA-WORLD Game Pack 01: deterministic test seams, persisted per-player challenges.
 * No gambling, real-money prizes or network calls. Reward policy enforced by core ledger.
 */
export const EXTRA_GAMES = Object.freeze([
  {id:'dice',name:'Tebak Dadu',command:'.dice 4',status:'playable'},
  {id:'parity',name:'Genap atau Ganjil',command:'.parity genap',status:'playable'},
  {id:'highlow',name:'Kartu Naik Turun',command:'.highlow naik',status:'playable'},
  {id:'math',name:'Matematika Cepat',command:'.math start',status:'playable'},
  {id:'trivia',name:'Kuis Pengetahuan',command:'.trivia start',status:'playable'},
  {id:'scramble',name:'Susun Kata',command:'.scramble start',status:'playable'},
  {id:'pattern',name:'Pola Angka',command:'.pattern start',status:'playable'},
  {id:'memory',name:'Memori Digit',command:'.memory start',status:'playable'},
  {id:'cipher',name:'Pecahkan Sandi ROT13',command:'.cipher start',status:'playable'},
  {id:'emoji',name:'Tebak Emoji',command:'.emoji start',status:'playable'},
  {id:'riddle',name:'Teka-teki',command:'.riddle start',status:'playable'},
  {id:'hangman',name:'Tebak Huruf',command:'.hangman start',status:'playable'},
  {id:'chain',name:'Sambung Kata',command:'.chain start',status:'playable'}
]);
const bank={
 trivia:[['Planet biru? A Bumi / B Venus / C Mars','a'],['Planet merah? A Mars / B Venus / C Bumi','a'],['Bahasa untuk menata web? A CSS / B SQL / C Python','a']],
 scramble:[['TARKE','karet'],['PAITN','pinta'],['MRAUH','rumah']],
 emoji:[['🌧️☂️','hujan'],['🌞🌻','matahari'],['📚🏫','sekolah']],
 riddle:[['Aku punya jarum tapi tidak menjahit. Siapakah aku?','jam'],['Semakin diambil, semakin besar. Apa itu?','lubang'],['Punya gigi tapi tidak menggigit. Apa itu?','sisir']],
 cipher:[['XBQR','kode'],['ZNXR','make'],['JBEYQ','world']],
 hangman:[['KOMPUTER','komputer'],['SEKOLAH','sekolah'],['LAPTOP','laptop']]
};
const chainDictionary=new Set(['ular','rumah','harimau','udara','awan','nanas','surat','taman','naga','apel','laut','tikar','roda','ayam','makan','nasi','ikan','nama','alam','merah','hijau','udang','gambar','rusa','angin','negara','angsa','arah','hutan']);
const challengeNames=new Set(['math','trivia','scramble','pattern','memory','cipher','emoji','riddle','hangman','chain']);
const singleNames=new Set(['dice','parity','highlow']);
function safeInput(input){return String(input??'').trim().toLowerCase().slice(0,120);}
export function makeExtraGameDispatcher({db,draw,play,reward}){
  const get=(id,game)=>db.prepare('SELECT payload,updated_at FROM challenge_sessions WHERE user_id=? AND game=?').get(id,game);
  const set=(id,game,state,now)=>db.prepare(`INSERT INTO challenge_sessions(user_id,game,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,game) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`).run(id,game,JSON.stringify(state),now);
  const del=(id,game)=>db.prepare('DELETE FROM challenge_sessions WHERE user_id=? AND game=?').run(id,game);
  const finish=(id,key,game,now,win,credit)=>{
    play(id,now);
    const issued=win?reward(id,credit,`${game}-win`,key,now,{dailyGame:true}):0;
    return win?(issued?`✅ Menang! +${issued} V-Currency dan +${issued*2} XP.`:'✅ Benar! Batas hadiah game harian telah tercapai.'):'❌ Belum berhasil.';
  };
  return function extra(id,key,text,now){
    const [raw,...parts]=text.trim().split(/\s+/);
    const game=raw?.slice(1)?.toLowerCase(),answer=safeInput(parts.join(' '));
    if(!singleNames.has(game)&&!challengeNames.has(game)) return null;
    if(singleNames.has(game)){
      if(game==='dice'){
        if(!/^[1-6]$/.test(answer))return '🎲 Tebak dadu 1–6: .dice 4';
        const rolled=draw(1,7);
        return `🎲 Hasil: ${rolled}. ${finish(id,key,game,now,Number(answer)===rolled,6)}`;
      }
      if(game==='parity'){
        if(!['genap','ganjil'].includes(answer))return '🔢 Pilih: .parity genap atau .parity ganjil';
        const rolled=draw(1,11),actual=rolled%2===0?'genap':'ganjil';
        return `🔢 Angka ${rolled} (${actual}). ${finish(id,key,game,now,answer===actual,3)}`;
      }
      if(!['naik','turun'].includes(answer))return '🃏 Tebak kartu kedua: .highlow naik atau .highlow turun';
      const first=draw(1,14),second=draw(1,14),actual=second>first?'naik':second<first?'turun':'seri';
      return `🃏 Kartu ${first} → ${second} (${actual}). ${finish(id,key,game,now,answer===actual,5)}`;
    }
    if(!answer||answer==='start'){
      let state,prompt;
      if(game==='math'){
        const a=draw(2,15),b=draw(2,15),op=draw(0,2)?'+':'×';
        state={solution:String(op==='+'?a+b:a*b),tries:2};prompt=`${a} ${op} ${b} = ?`;
      } else if(game==='pattern'){
        const base=draw(1,10),step=draw(2,7);
        state={solution:String(base+step*4),tries:2};prompt=`Lanjutkan: ${[0,1,2,3].map(x=>base+x*step).join(', ')}, ?`;
      } else if(game==='memory'){
        const secret=String(draw(1000,9999));state={solution:secret,tries:1};prompt=`Ingat kode ${secret} lalu balas persis (jangan scroll ke atas 😊).`;
      } else if(game==='chain'){
        state={current:'buku',used:['buku'],steps:0,tries:2};prompt='Mulai dari BUKU. Sambung kata bahasa Indonesia yang dimulai huruf U. Selesaikan 3 kata berbeda.';
      } else {
        const rows=bank[game],idx=draw(0,rows.length),[question,solution]=rows[idx];
        if(game==='hangman'){
          state={solution,found:[],used:[],tries:6};prompt=`Tebak satu huruf: ${'_ '.repeat(solution.length).trim()} (6 kesempatan)`;
        } else {state={solution,tries:2};prompt=question;}
      }
      set(id,game,state,now);
      return `🎮 ${game.toUpperCase()} dimulai!\n${prompt}\nBalas .${game} JAWABAN (reset: .${game} start).`;
    }
    const row=get(id,game);
    if(!row || now-row.updated_at>15*60*1000){del(id,game);return `⏱️ Sesi ${game} tidak ada atau kadaluarsa. Ketik .${game} start`;} 
    const state=JSON.parse(row.payload);
    if(game==='hangman'){
      if(!/^[a-z]$/.test(answer))return 'Tebak satu huruf saja: .hangman a';
      if(state.used.includes(answer))return `Huruf ${answer.toUpperCase()} sudah dicoba. Pilih huruf lain.`;
      state.used.push(answer);
      if(state.solution.includes(answer))state.found.push(answer);
      else state.tries--;
      const display=[...state.solution].map(c=>state.found.includes(c)?c.toUpperCase():'_').join(' ');
      const win=[...state.solution].every(c=>state.found.includes(c));
      if(win||state.tries<=0){del(id,game);return `${display}\n${win?'Kata terpecahkan!':'Jawaban: '+state.solution.toUpperCase()} ${finish(id,key,game,now,win,14)}`;}
      set(id,game,state,now);
      return `${display}\nSisa ${state.tries} kesempatan. Huruf terpakai: ${state.used.join(', ')}`;
    }
    if(game==='chain'){
      const expected=state.current.at(-1);
      if(!/^[a-z]{3,18}$/.test(answer)||!chainDictionary.has(answer))return 'Gunakan kata dari kamus game, misalnya ular, rumah, harimau, udara, atau awan.';
      if(state.used.includes(answer))return 'Kata ini sudah digunakan.';
      if(!answer.startsWith(expected)){
        state.tries--;
        if(!state.tries){del(id,game);return `Huruf harus ${expected.toUpperCase()}. ${finish(id,key,game,now,false,0)}`;}
        set(id,game,state,now);return `Huruf berikutnya harus ${expected.toUpperCase()}. Kesempatan tersisa ${state.tries}.`;
      }
      state.current=answer;state.used.push(answer);state.steps++;
      if(state.steps>=3){del(id,game);return `Rangkaian: ${state.used.join(' → ')}\n${finish(id,key,game,now,true,12)}`;}
      set(id,game,state,now);
      return `Bagus! ${state.steps}/3 kata. Kata selanjutnya harus mulai huruf ${answer.at(-1).toUpperCase()}.`;
    }
    const ok=answer===String(state.solution).toLowerCase();
    if(ok){del(id,game);return finish(id,key,game,now,true,game==='memory'?10:8);}
    state.tries--;
    if(state.tries<=0){del(id,game);return `Jawaban: ${String(state.solution).toUpperCase()}. ${finish(id,key,game,now,false,0)}`;}
    set(id,game,state,now);
    return `❌ Belum tepat. Sisa ${state.tries} kesempatan. Coba .${game} JAWABAN.`;
  };
}
