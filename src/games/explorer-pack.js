/** Pack 04: twelve independent puzzle challenges. No remote APIs, wagering or top-up.
 * Session-per-player, 15-minute expiry, two attempts, shared capped rewards.
 */
export const EXPLORER_GAMES=Object.freeze([
{id:'primefactors',name:'Faktor Prima',command:'.primefactors start',status:'playable'},
{id:'median',name:'Cari Median',command:'.median start',status:'playable'},
{id:'mode',name:'Modus Data',command:'.mode start',status:'playable'},
{id:'manhattan',name:'Jarak Manhattan',command:'.manhattan start',status:'playable'},
{id:'perimeter',name:'Keliling Persegi Panjang',command:'.perimeter start',status:'playable'},
{id:'triangle',name:'Luas Segitiga',command:'.triangle start',status:'playable'},
{id:'chance',name:'Peluang Bola',command:'.chance start',status:'playable'},
{id:'utcwib',name:'Konversi UTC WIB',command:'.utcwib start',status:'playable'},
{id:'divisible',name:'Uji Habis Dibagi',command:'.divisible start',status:'playable'},
{id:'caesar',name:'Pecahkan Caesar',command:'.caesar start',status:'playable'},
{id:'a1z26',name:'Kode Huruf A1Z26',command:'.a1z26 start',status:'playable'},
{id:'setunion',name:'Gabungan Himpunan',command:'.setunion start',status:'playable'}
]);
const ids=new Set(EXPLORER_GAMES.map(g=>g.id));
const words=['DATA','KODE','SAPA','BOT','GAME','DUNIA'];
function primeString(n){let x=n,parts=[];for(let k=2;k*k<=x;k++)while(x%k===0){parts.push(k);x/=k;}if(x>1)parts.push(x);return parts.join('x');}
function ask(name,draw){
 const r=(a,b)=>draw(a,b),list=(arr)=>arr.join(', ');
 switch(name){
  case 'primefactors':{const a=r(2,9),b=r(2,9),n=a*b;return {question:`Uraikan ${n} menjadi faktor prima terurut. Contoh 12 = 2x2x3.`,solution:primeString(n)};}
  case 'median':{const a=r(1,6),nums=[a,a+2,a+4,a+6,a+8],display=[nums[4],nums[1],nums[3],nums[0],nums[2]];return {question:`Median data [${list(display)}] adalah?`,solution:String(nums[2])};}
  case 'mode':{const a=r(1,9),b=a+1,arr=[a,b,a,a,b, b+1];return {question:`Modus data [${list(arr)}] adalah?`,solution:String(a)};}
  case 'manhattan':{const x1=r(-4,5),y1=r(-4,5),x2=r(-4,5),y2=r(-4,5);return {question:`Jarak Manhattan antara (${x1},${y1}) dan (${x2},${y2}) adalah?`,solution:String(Math.abs(x2-x1)+Math.abs(y2-y1))};}
  case 'perimeter':{const p=r(2,21),l=r(2,21);return {question:`Keliling persegi panjang panjang ${p} dan lebar ${l}?`,solution:String(2*(p+l))};}
  case 'triangle':{const alas=r(2,15)*2,tinggi=r(2,15);return {question:`Luas segitiga alas ${alas} dan tinggi ${tinggi}?`,solution:String(alas*tinggi/2)};}
  case 'chance':{const merah=r(1,5),biru=r(1,5);return {question:`Dalam kotak ada ${merah} bola merah dan ${biru} bola biru. Peluang mendapat merah? Jawab pecahan a/b paling sederhana.`,solution:(()=>{const gcd=(a,b)=>b?gcd(b,a%b):a;const d=gcd(merah,merah+biru);return `${merah/d}/${(merah+biru)/d}`;})()};}
  case 'utcwib':{const utc=r(0,24),wib=(utc+7)%24;return {question:`Jika jam UTC ${String(utc).padStart(2,'0')}:00, jam WIB berapa? Jawab HH:00.`,solution:`${String(wib).padStart(2,'0')}:00`};}
  case 'divisible':{const n=r(11,100),d=[3,5,9][r(0,3)];return {question:`Apakah ${n} habis dibagi ${d}? Jawab ya/tidak.`,solution:n%d===0?'ya':'tidak'};}
  case 'caesar':{const word=words[r(0,words.length)],shift=r(1,5),enc=[...word].map(c=>String.fromCharCode(65+(c.charCodeAt(0)-65+shift)%26)).join('');return {question:`Dekripsi Caesar shift +${shift} dari ciphertext "${enc}". Jawab plaintext.`,solution:word.toLowerCase()};}
  case 'a1z26':{const word=words[r(0,words.length)],nums=[...word].map(c=>c.charCodeAt(0)-64);return {question:`Pecahkan A1Z26 [${nums.join('-')}]. Jawab kata.`,solution:word.toLowerCase()};}
  case 'setunion':{const a=r(1,7),A=[a,a+2],B=[a+1,a+2];return {question:`Gabungan {${A.join(',')}} U {${B.join(',')}}? Tulis angka urut pisahkan koma (contoh 1,2,3).`,solution:[a,a+1,a+2].join(',')};}
  default:throw Error('Unknown explorer game');
 }
}
export function makeExplorerDispatcher({db,draw,play,reward}){
 const get=db.prepare('SELECT payload,updated_at FROM challenge_sessions WHERE user_id=? AND game=?');
 const save=db.prepare('INSERT INTO challenge_sessions(user_id,game,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,game) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at');
 const del=db.prepare('DELETE FROM challenge_sessions WHERE user_id=? AND game=?');
 return (id,eventKey,text,now)=>{
  const [command,...args]=text.trim().toLowerCase().split(/\s+/);const game=command.slice(1);
  if(!ids.has(game))return null;
  const input=args.join(' ').trim();
  if(!input||input==='start'){
   const task=ask(game,draw);save.run(id,game,JSON.stringify({...task,tries:2}),now);
   return `🧭 ${game.toUpperCase()}!\n${task.question}\nJawab: .${game} JAWABAN (reset: .${game} start).`;
  }
  const row=get.get(id,game);
  if(!row||now-row.updated_at>15*60_000){del.run(id,game);return `⏱️ Sesi ${game} kedaluwarsa. Ketik .${game} start`}
  const state=JSON.parse(row.payload);
  if(input.replace(/\s+/g,'')===state.solution){
   del.run(id,game);play(id,now);
   const amount=reward(id,7,`${game}-win`,eventKey,now,{dailyGame:true});
   return amount?`✅ Jawaban benar! +${amount} V dan +${amount*2} XP.`:'✅ Benar! Batas hadiah game hari ini telah tercapai.';
  }
  state.tries--;
  if(state.tries<=0){del.run(id,game);play(id,now);return `❌ Kesempatan habis. Jawaban: ${state.solution}. Mulai lagi: .${game} start`}
  save.run(id,game,JSON.stringify(state),now);
  return `❌ Belum tepat. Sisa ${state.tries} percobaan. ${state.question}`;
 };
}
