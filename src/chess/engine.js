/** WA-WORLD v1.2 self-contained chess rule engine. Coordinates: a1=0 ... h8=63. */
const BACK='RNBQKBNR';
export const sq=s=>/^[a-h][1-8]$/.test(s)?(s.charCodeAt(0)-97)+(Number(s[1])-1)*8:-1;
export const algebraic=i=>String.fromCharCode(97+i%8)+(Math.floor(i/8)+1);
const white=p=>p===p.toUpperCase();
const own=(p,c)=>!!p&&(c==='w'?white(p):!white(p));
const color=p=>white(p)?'w':'b';
const typ=p=>p.toUpperCase();
const xy=i=>[i%8,Math.floor(i/8)];
const index=(x,y)=>x>=0&&x<8&&y>=0&&y<8?y*8+x:-1;
const clone=s=>({...s,b:[...s.b], history:[...s.history]});
const opp=c=>c==='w'?'b':'w';
export function initialChess(){const b=Array(64).fill(null);for(let i=0;i<8;i++){b[i]=BACK[i];b[8+i]='P';b[48+i]='p';b[56+i]=BACK[i].toLowerCase();}return {b,turn:'w',castle:'KQkq',ep:-1,half:0,full:1,history:[],last:null,result:null};}
function pathClear(b,x,y,tx,ty){const dx=Math.sign(tx-x),dy=Math.sign(ty-y);let a=x+dx,c=y+dy;while(a!==tx||c!==ty){if(b[index(a,c)])return false;a+=dx;c+=dy;}return true;}
function attacked(s,pos,by){const [tx,ty]=xy(pos);for(let i=0;i<64;i++){const p=s.b[i];if(!own(p,by))continue;const [x,y]=xy(i),dx=tx-x,dy=ty-y,ad=Math.abs(dx),ay=Math.abs(dy);switch(typ(p)){
 case 'P':if(ay===1&&ad===1&&dy===(by==='w'?1:-1))return true;break;
 case 'N':if(ad*ay===2 && ad+ay===3)return true;break;
 case 'K':if(Math.max(ad,ay)===1)return true;break;
 case 'B':if(ad===ay&&ad>0&&pathClear(s.b,x,y,tx,ty))return true;break;
 case 'R':if((ad===0)!==(ay===0)&&pathClear(s.b,x,y,tx,ty))return true;break;
 case 'Q':if(((ad===0)!==(ay===0)||ad===ay)&&ad+ay>0&&pathClear(s.b,x,y,tx,ty))return true;break;
 }}return false;}
export function inCheck(s,c){const pos=s.b.findIndex(p=>p&&(typ(p)==='K')&&color(p)===c);return pos<0 || attacked(s,pos,opp(c));}
function pseudo(s,from,to,promotion='q'){
 const b=s.b,p=b[from];if(!p||!own(p,s.turn)||own(b[to],s.turn)||typ(b[to]??'')==='K')return false;
 const [x,y]=xy(from),[tx,ty]=xy(to),dx=tx-x,dy=ty-y,ad=Math.abs(dx),ay=Math.abs(dy),target=b[to];
 switch(typ(p)){
 case 'P':{const dir=s.turn==='w'?1:-1,start=s.turn==='w'?1:6,last=s.turn==='w'?7:0;
 if(ty===last&&!['q','r','b','n'].includes(promotion))return false;
 if(dx===0&&!target&&(dy===dir||(y===start&&dy===dir*2&&!b[index(x,y+dir)])))return true;
 return ad===1&&dy===dir&&(!!target||to===s.ep);
 }
 case 'N':return ad*ay===2&&ad+ay===3;
 case 'B':return ad===ay&&ad!==0&&pathClear(b,x,y,tx,ty);
 case 'R':return ((ad===0)!==(ay===0))&&pathClear(b,x,y,tx,ty);
 case 'Q':return (ad===ay&&ad!==0||((ad===0)!==(ay===0)))&&pathClear(b,x,y,tx,ty);
 case 'K':if(Math.max(ad,ay)===1)return true;
 if(dy!==0||ad!==2||inCheck(s,s.turn))return false;
 const right=s.turn==='w'?(dx===2?'K':'Q'):(dx===2?'k':'q');
 if(!s.castle.includes(right))return false;
 const rook=index(dx===2?7:0,y);if(b[rook]!== (s.turn==='w'?'R':'r'))return false;
 if(dx===2 && (b[index(5,y)]||b[index(6,y)]))return false;
 if(dx===-2 && (b[index(1,y)]||b[index(2,y)]||b[index(3,y)]))return false;
 return !attacked(s,index(x+Math.sign(dx),y),opp(s.turn))&&!attacked(s,to,opp(s.turn));
 }return false;
}
function execute(s,from,to,promotion){const next=clone(s),b=next.b,p=b[from],captured=b[to],c=next.turn,[x,y]=xy(from),[tx,ty]=xy(to);let took=!!captured;
 if(typ(p)==='P'&&x!==tx&&!captured&&to===s.ep){b[index(tx,y)]=null;took=true;}
 b[from]=null;b[to]=p;
 if(typ(p)==='P'&&(ty===7||ty===0))b[to]=c==='w'?promotion.toUpperCase():promotion;
 if(typ(p)==='K'&&Math.abs(tx-x)===2){const rookFrom=index(tx>x?7:0,y),rookTo=index(tx>x?5:3,y);b[rookTo]=b[rookFrom];b[rookFrom]=null;}
 const removes=new Set();if(typ(p)==='K'){for(const z of(c==='w'?'KQ':'kq'))removes.add(z);}
 for(const [point,right] of [[0,'Q'],[7,'K'],[56,'q'],[63,'k']])if(from===point||to===point)removes.add(right);
 next.castle=[...s.castle].filter(z=>!removes.has(z)).join('');
 next.ep=typ(p)==='P'&&Math.abs(ty-y)===2?index(x,y+(c==='w'?1:-1)):-1;
 next.half=(typ(p)==='P'||took)?0:s.half+1;next.full=s.full+(c==='b'?1:0);next.turn=opp(c);
 next.last=algebraic(from)+algebraic(to)+(typ(p)==='P'&&(ty===7||ty===0)?promotion:'');
 return next;}
const signature=s=>s.b.map(p=>p||'.').join('')+'/'+s.turn+'/'+s.castle+'/'+s.ep;
function insufficient(s){const minor=s.b.filter(x=>x&&typ(x)!=='K');return minor.length===0||(minor.length===1&&['N','B'].includes(typ(minor[0])));}
function legal(s,from,to,promo){return pseudo(s,from,to,promo)&&!inCheck(execute(s,from,to,promo),s.turn);}
function hasLegal(s){for(let f=0;f<64;f++)if(own(s.b[f],s.turn))for(let t=0;t<64;t++)if(legal(s,f,t,'q'))return true;return false;}
export function moveChess(s,uci){if(s.result)throw Error('Pertandingan catur sudah selesai.');if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci))throw Error('Gunakan langkah UCI, contoh e2e4 atau e7e8q.');
 const from=sq(uci.slice(0,2)),to=sq(uci.slice(2,4)),promotion=uci[4]||'q';if(!legal(s,from,to,promotion))throw Error('Langkah tidak legal atau menyebabkan skak pada raja sendiri.');
 const next=execute(s,from,to,promotion);next.history.push(signature(next));
 if(!hasLegal(next))next.result=inCheck(next,next.turn)?{type:'CHECKMATE',winner:opp(next.turn)}:{type:'STALEMATE',winner:null};
 else if(next.half>=100)next.result={type:'FIFTY_MOVE',winner:null};
 else if(insufficient(next))next.result={type:'INSUFFICIENT',winner:null};
 else if(next.history.filter(x=>x===signature(next)).length>=3)next.result={type:'REPETITION',winner:null};
 return next;
}
export function fen(s){const rows=[];for(let y=7;y>=0;y--){let count=0,row='';for(let x=0;x<8;x++){const p=s.b[index(x,y)];if(p){if(count)row+=count;count=0;row+=p;}else count++;}if(count)row+=count;rows.push(row);}return `${rows.join('/')} ${s.turn} ${s.castle||'-'} ${s.ep<0?'-':algebraic(s.ep)} ${s.half} ${s.full}`;}
