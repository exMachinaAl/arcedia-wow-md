/** WA-WORLD Game Pack 03: twelve independent, session-based micro-games.
 * Pure challenge generators + DB-backed expiry + central reward ledger.
 * No payments, bets, peer messages or external services.
 */
export const ADVENTURE_GAMES = Object.freeze([
  {id:'factorial',name:'Faktorial Cepat',command:'.factorial start',status:'playable'},
  {id:'gcd',name:'FPB Dua Bilangan',command:'.gcd start',status:'playable'},
  {id:'lcm',name:'KPK Dua Bilangan',command:'.lcm start',status:'playable'},
  {id:'discount',name:'Diskon Pintar',command:'.discount start',status:'playable'},
  {id:'operator',name:'Operator Hilang',command:'.operator start',status:'playable'},
  {id:'quadrant',name:'Kuadran Koordinat',command:'.quadrant start',status:'playable'},
  {id:'clock',name:'Jam Bergeser',command:'.clock start',status:'playable'},
  {id:'morse',name:'Pecahkan Morse',command:'.morse start',status:'playable'},
  {id:'palindrome',name:'Detektif Palindrom',command:'.palindrome start',status:'playable'},
  {id:'vowels',name:'Pemburu Huruf Vokal',command:'.vowels start',status:'playable'},
  {id:'reverse',name:'Kata Cermin',command:'.reverse start',status:'playable'},
  {id:'fraction',name:'Pecahan Sederhana',command:'.fraction start',status:'playable'}
]);
const names = new Set(ADVENTURE_GAMES.map(g=>g.id));
const gcd=(a,b)=>b?gcd(b,a%b):a;
const words=['kamera','komputer','sekolah','belajar','petualang','semangat','musik'];
const morse={A:'.-', B:'-...', C:'-.-.', D:'-..', E:'.', F:'..-.', G:'--.', H:'....', I:'..', J:'.---', K:'-.-', L:'.-..', M:'--', N:'-.', O:'---', P:'.--.', Q:'--.-', R:'.-.', S:'...', T:'-', U:'..-', V:'...-', W:'.--', X:'-..-',Y:'-.--',Z:'--..'};
const morseWords=['SOS','KODE','BOLA','DATA','API'];
const palindromeWords=['katak','malam','level','rotor','radar','kertas','komputer','pohon'];
function ask(game,draw){
  const r=(a,b)=>draw(a,b);
  switch(game){
    case 'factorial':{const n=r(3,7);let v=1;for(let i=2;i<=n;i++)v*=i;return {question:`Hitung ${n}! (faktorial).`,solution:String(v)};}
    case 'gcd':{const a=r(12,51),b=r(6,31);return {question:`Berapa FPB(${a}, ${b})?`,solution:String(gcd(a,b))};}
    case 'lcm':{const a=r(2,11),b=r(2,11);return {question:`Berapa KPK(${a}, ${b})?`,solution:String(a*b/gcd(a,b))};}
    case 'discount':{const base=r(2,11)*100,rate=[10,20,25,50][r(0,4)];return {question:`Barang ${base} V mendapat diskon ${rate}%. Harga akhirnya (angka saja)?`,solution:String(base*(100-rate)/100)};}
    case 'operator':{const a=r(2,10),b=r(2,10),op=['+','-','*'][r(0,3)];const value=op==='+'?a+b:op==='-'?a-b:a*b;return {question:`Isi operator (+, -, *): ${a} ? ${b} = ${value}`,solution:op};}
    case 'quadrant':{const x=r(1,9)*(r(0,2)?1:-1),y=r(1,9)*(r(0,2)?1:-1);const q=x>0?(y>0?'1':'4'):(y>0?'2':'3');return {question:`Titik (${x}, ${y}) ada di kuadran berapa? Jawab 1/2/3/4.`,solution:q};}
    case 'clock':{const hour=r(0,24),minute=r(0,2)*30,add=[30,60,90,120][r(0,4)];const total=(hour*60+minute+add)%(24*60);const pad=n=>String(n).padStart(2,'0');return {question:`Pukul ${pad(hour)}:${pad(minute)} ditambah ${add} menit. Jam berapa? (HH:MM)`,solution:`${pad(Math.floor(total/60))}:${pad(total%60)}`};}
    case 'morse':{const word=morseWords[r(0,morseWords.length)];return {question:`Uraikan Morse menjadi huruf: ${[...word].map(c=>morse[c]).join(' / ')}`,solution:word.toLowerCase()};}
    case 'palindrome':{const word=palindromeWords[r(0,palindromeWords.length)];return {question:`Apakah "${word}" palindrom? Jawab ya/tidak.`,solution:word===word.split('').reverse().join('')?'ya':'tidak'};}
    case 'vowels':{const word=words[r(0,words.length)];return {question:`Ada berapa huruf vokal (a,i,u,e,o) pada "${word}"?`,solution:String((word.match(/[aiueo]/g)||[]).length)};}
    case 'reverse':{const word=words[r(0,words.length)];return {question:`Balik susunan huruf "${word}".`,solution:[...word].reverse().join('')};}
    case 'fraction':{const numerator=r(2,10),denominator=r(2,10),multiplier=r(2,6);const a=numerator*multiplier,b=denominator*multiplier,d=gcd(a,b);return {question:`Sederhanakan pecahan ${a}/${b}. Jawab a/b.`,solution:`${a/d}/${b/d}`};}
    default: throw Error('Unknown game');
  }
}
export function makeAdventureDispatcher({db,draw,play,reward}){
  const fetch=db.prepare('SELECT payload,updated_at FROM challenge_sessions WHERE user_id=? AND game=?');
  const upsert=db.prepare('INSERT INTO challenge_sessions(user_id,game,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,game) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at');
  const remove=db.prepare('DELETE FROM challenge_sessions WHERE user_id=? AND game=?');
  return (id,eventKey,text,now)=>{
    const [raw,...parts]=text.trim().toLowerCase().split(/\s+/);
    const game=raw.slice(1);if(!names.has(game))return null;
    const input=parts.join(' ').trim();
    if(input===''||input==='start'){
      const {question,solution}=ask(game,draw);
      upsert.run(id,game,JSON.stringify({question,solution,tries:2}),now);
      return `🎯 ${game.toUpperCase()}!\n${question}\nJawab: .${game} JAWABAN (reset: .${game} start).`;
    }
    const session=fetch.get(id,game);
    if(!session||now-session.updated_at>15*60_000){remove.run(id,game);return `⏱️ Sesi ${game} kedaluwarsa. Ketik .${game} start`}
    const state=JSON.parse(session.payload);
    const answer=input.replace(/\s+/g,'');
    const correct=answer===state.solution;
    if(correct){
      remove.run(id,game);play(id,now);
      const amount=reward(id,7,`${game}-win`,eventKey,now,{dailyGame:true});
      return amount?`✅ Jawaban benar! +${amount} V dan +${amount*2} XP.`:'✅ Benar! Batas hadiah game hari ini telah tercapai.';
    }
    state.tries--;
    if(state.tries<=0){remove.run(id,game);play(id,now);return `❌ Kesempatan habis. Jawaban: ${state.solution}. Main lagi: .${game} start`}
    upsert.run(id,game,JSON.stringify(state),now);
    return `❌ Belum tepat. Sisa ${state.tries} percobaan. ${state.question}`;
  };
}
