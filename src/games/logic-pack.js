/** Puzzle Pack 02: eight different short problem generators, independently persisted. */
export const LOGIC_GAMES=Object.freeze([
 {id:'binary',name:'Konversi Biner',command:'.binary start',status:'playable'},
 {id:'roman',name:'Angka Romawi',command:'.roman start',status:'playable'},
 {id:'equation',name:'Cari Nilai X',command:'.equation start',status:'playable'},
 {id:'prime',name:'Detektif Bilangan Prima',command:'.prime start',status:'playable'},
 {id:'sort',name:'Urut Angka',command:'.sort start',status:'playable'},
 {id:'logic',name:'Logika Boolean',command:'.logic start',status:'playable'},
 {id:'digit',name:'Jumlah Digit',command:'.digit start',status:'playable'},
 {id:'alphabet',name:'Geser Huruf',command:'.alphabet start',status:'playable'}
]);
const names=new Set(LOGIC_GAMES.map(g=>g.id));
const isPrime=n=>n>1&&Array.from({length:Math.floor(Math.sqrt(n))-1},(_,i)=>i+2).every(d=>n%d!==0);
function roman(n){let s='';for(const [v,t] of [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']])while(n>=v){s+=t;n-=v;}return s;}
function challenge(game,draw){
 let question='',solution='';
 if(game==='binary'){const n=draw(4,32);question=`Ubah ${n} ke bilangan biner (tanpa prefix 0b).`;solution=n.toString(2);}
 if(game==='roman'){const n=draw(1,40);question=`Tuliskan ${n} dalam angka Romawi.`;solution=roman(n).toLowerCase();}
 if(game==='equation'){const a=draw(2,7),x=draw(1,11),b=draw(1,10);question=`Cari x: ${a}x + ${b} = ${a*x+b}`;solution=String(x);}
 if(game==='prime'){const n=draw(2,48);question=`Apakah ${n} bilangan prima? Ketik prima atau bukan.`;solution=isPrime(n)?'prima':'bukan';}
 if(game==='sort'){
  const nums=[draw(1,10),draw(11,20),draw(21,30),draw(31,40)];
  question=`Urutkan dari kecil ke besar, pisahkan koma: ${nums.slice().reverse().join(', ')}`;solution=nums.join(',');
 }
 if(game==='logic'){
  const a=!!draw(0,2),b=!!draw(0,2),op=draw(0,2)?'AND':'OR';
  question=`TRUE/FALSE: (${a?'TRUE':'FALSE'} ${op} ${b?'TRUE':'FALSE'})? Jawab true atau false.`;
  solution=String(op==='AND'?a&&b:a||b);
 }
 if(game==='digit'){const n=draw(1000,9999);question=`Jumlah seluruh digit pada ${n} = ?`;solution=String([...String(n)].reduce((sum,v)=>sum+Number(v),0));}
 if(game==='alphabet'){const start=draw(0,20),step=draw(1,6);question=`Huruf setelah ${String.fromCharCode(65+start)} maju ${step} langkah alfabet (A-Z) = ?`;solution=String.fromCharCode(97+start+step);}
 return {question,solution};
}
export function makeLogicDispatcher({db,draw,play,reward}){
 const fetch=db.prepare('SELECT payload,updated_at FROM challenge_sessions WHERE user_id=? AND game=?');
 const upsert=db.prepare('INSERT INTO challenge_sessions(user_id,game,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,game) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at');
 const remove=db.prepare('DELETE FROM challenge_sessions WHERE user_id=? AND game=?');
 return (id,eventKey,text,now)=>{
  const [raw,...parts]=text.trim().toLowerCase().split(/\s+/);
  const game=raw.slice(1);if(!names.has(game))return null;
  const input=parts.join(' ').trim();
  if(input===''||input==='start'){
    const {question,solution}=challenge(game,draw);
    upsert.run(id,game,JSON.stringify({solution,question,tries:2}),now);
    return `🧠 ${game.toUpperCase()} dimulai!\n${question}\nBalas .${game} JAWABAN (reset: .${game} start).`;
  }
  const session=fetch.get(id,game);
  if(!session||now-session.updated_at>15*60_000){remove.run(id,game);return `⏱️ Sesi ${game} kadaluarsa. Gunakan .${game} start`;}
  const state=JSON.parse(session.payload);
  const normalized=game==='sort'?input.replace(/\s+/g,''):input;
  const correct=normalized===state.solution;
  if(correct){
    remove.run(id,game);play(id,now);
    const earned=reward(id,9,`${game}-win`,eventKey,now,{dailyGame:true});
    return earned?`✅ Tepat! +${earned} V-Currency dan +${earned*2} XP.`:'✅ Tepat! Batas hadiah permainan hari ini telah tercapai.';
  }
  state.tries--;
  if(state.tries<=0){remove.run(id,game);play(id,now);return `❌ Jawaban: ${state.solution.toUpperCase()}. Main lagi: .${game} start`;}
  upsert.run(id,game,JSON.stringify(state),now);
  return `❌ Salah. Sisa ${state.tries} kesempatan. ${state.question}`;
 };
}
