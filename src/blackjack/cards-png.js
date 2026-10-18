/** Dependency-free PNG renderer. Never render other players' hidden cards. */
import {deflateSync} from 'node:zlib';
const W=540,H=288;
const F={
 '0':['111','101','101','101','111'],'1':['010','110','010','010','111'],'2':['110','001','010','100','111'],
 '3':['110','001','010','001','110'],'4':['101','101','111','001','001'],'5':['111','100','111','001','110'],
 '6':['011','100','111','101','111'],'7':['111','001','010','010','010'],'8':['111','101','111','101','111'],
 '9':['111','101','111','001','110'],'A':['010','101','111','101','101'],'K':['101','110','100','110','101'],
 'Q':['111','101','101','111','001'],'J':['111','001','001','101','010'],'S':['011','100','010','001','110'],
 'H':['101','101','111','101','101'],'D':['110','101','101','101','110'],'C':['111','100','100','100','111'],
 '?':['110','001','010','000','010'], ' ':['000','000','000','000','000']
};
const col={bg:[22,91,69],card:[248,247,243],ink:[27,36,49],red:[183,47,57],shade:[51,64,87],gold:[234,178,64]};
function crc(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,buf){const t=Buffer.from(type),len=Buffer.alloc(4),sum=Buffer.alloc(4);len.writeUInt32BE(buf.length);sum.writeUInt32BE(crc(Buffer.concat([t,buf])));return Buffer.concat([len,t,buf,sum]);}
export function renderBlackjackCards({hand=[],dealer=[],reveal=false}){
 const rgb=Buffer.alloc(W*H*3);function pixel(x,y,c){if(x<0||y<0||x>=W||y>=H)return;const off=(y*W+x)*3;rgb[off]=c[0];rgb[off+1]=c[1];rgb[off+2]=c[2];}
 function rect(x,y,w,h,c){for(let a=y;a<y+h;a++)for(let b=x;b<x+w;b++)pixel(b,a,c);}
 function text(str,x,y,color,size=3){for(const char of String(str)){const p=F[char]||F['?'];for(let row=0;row<5;row++)for(let co=0;co<3;co++)if(p[row][co]==='1')rect(x+co*size,y+row*size,size,size,color);x+=size*4;}}
 function card(code,x,y){rect(x+3,y+3,72,96,col.shade);rect(x,y,72,96,col.card);rect(x+3,y+3,66,90,[229,231,231]);rect(x+7,y+7,58,82,col.card);
  if(code==='??'){rect(x+12,y+12,48,72,col.shade);text('??',x+17,y+31,col.gold,5);return;}
  const rank=code.slice(0,-1),suit=code.slice(-1),ink=['H','D'].includes(suit)?col.red:col.ink;
  text(rank,x+12,y+13,ink,4);text(suit,x+14,y+51,ink,4);
 }
 rect(0,0,W,H,col.bg);rect(14,12,W-28,H-24,[19,76,59]);text('DEALER',22,20,col.card,3);
 const shown=reveal?dealer:[dealer[0]||'??','??'];for(let i=0;i<Math.min(shown.length,5);i++)card(shown[i],20+i*80,43);
 text('YOU',22,153,col.card,3);
 for(let i=0;i<Math.min(hand.length,6);i++)card(hand[i],20+i*80,174);
 // Both dealer and player cards fit fully within the canvas.
 const raw=Buffer.alloc(H*(1+W*3));for(let y=0;y<H;y++){let start=y*(W*3+1);raw[start]=0;rgb.copy(raw,start+1,y*W*3,(y+1)*W*3);}
 const head=Buffer.alloc(13);head.writeUInt32BE(W,0);head.writeUInt32BE(H,4);head[8]=8;head[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))]);
}
