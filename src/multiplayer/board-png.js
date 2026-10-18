/** Small dependency-free raster PNG renderer for 10x10 snakes-and-ladders boards. */
import {deflateSync} from 'node:zlib';
const WIDTH=600,HEIGHT=600,M=20,CELL=56;
const PAL={white:[255,255,255],black:[36,47,58],red:[215,55,72],blue:[37,109,225],green:[35,155,97],gold:[243,176,44],pale:[245,246,248],beige:[227,235,247]};
const font={
'0':['111','101','101','101','111'],'1':['010','110','010','010','111'],'2':['111','001','111','100','111'],'3':['111','001','111','001','111'],'4':['101','101','111','001','001'],'5':['111','100','111','001','111'],'6':['111','100','111','101','111'],'7':['111','001','010','010','010'],'8':['111','101','111','101','111'],'9':['111','101','111','001','111']};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function crc32(buf) {let c=0xffffffff;for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(tag,buf){const type=Buffer.from(tag),len=Buffer.alloc(4),sum=Buffer.alloc(4);len.writeUInt32BE(buf.length);sum.writeUInt32BE(crc32(Buffer.concat([type,buf])));return Buffer.concat([len,type,buf,sum]);}
export function renderSnakeBoard({state,snakes,ladders}) {
 const rgb=Buffer.alloc(WIDTH*HEIGHT*3,255);
 function px(x,y,color){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=WIDTH||y>=HEIGHT)return;const i=(y*WIDTH+x)*3;rgb[i]=color[0];rgb[i+1]=color[1];rgb[i+2]=color[2];}
 function fill(x,y,w,h,color){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)px(i,j,color);}
 function line(x0,y0,x1,y1,color,thickness=2){const steps=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))||1;for(let s=0;s<=steps;s++){const x=x0+(x1-x0)*s/steps,y=y0+(y1-y0)*s/steps;fill(Math.round(x-thickness/2),Math.round(y-thickness/2),thickness,thickness,color);}}
 function circle(cx,cy,r,color){for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(x*x+y*y<=r*r)px(cx+x,cy+y,color);}
 function text(str,x,y,color,scale=2){for(const ch of String(str)){const pat=font[ch]??font['0'];for(let yy=0;yy<5;yy++)for(let xx=0;xx<3;xx++)if(pat[yy][xx]==='1')fill(x+xx*scale,y+yy*scale,scale,scale,color);x+=4*scale;}}
 const loc=n=>{if(n<=0)return [M+CELL/2,M+CELL*10-CELL/2];const idx=n-1,row=Math.floor(idx/10),slot=idx%10;const col=row%2===0?slot:9-slot;return [M+col*CELL+CELL/2,M+(9-row)*CELL+CELL/2];};
 fill(0,0,WIDTH,HEIGHT,PAL.white);
 for(let n=1;n<=100;n++){const [x,y]=loc(n);fill(x-CELL/2,y-CELL/2,CELL-1,CELL-1,Math.floor((n-1)/10)%2===n%2?PAL.beige:PAL.pale);text(n,x-17,y-22,PAL.black,2);}
 for(const [from,to] of Object.entries(ladders)){const [x,y]=loc(Number(from)),[a,b]=loc(to);line(x,y,a,b,PAL.green,5);circle(x,y,6,PAL.green);}
 for(const [from,to] of Object.entries(snakes)){const [x,y]=loc(Number(from)),[a,b]=loc(to);line(x,y,a,b,PAL.red,5);circle(x,y,7,PAL.red);}
 for(let i=0;i<2;i++){const [x,y]=loc(state.positions[i]);circle(x+(i===0?-11:11),y+11,11,i===0?PAL.red:PAL.blue);circle(x+(i===0?-11:11),y+11,5,PAL.white);}
 const raw=Buffer.alloc(HEIGHT*(1+WIDTH*3));for(let y=0;y<HEIGHT;y++){const start=y*(1+WIDTH*3);raw[start]=0;rgb.copy(raw,start+1,y*WIDTH*3,(y+1)*WIDTH*3);}
 const header=Buffer.alloc(13);header.writeUInt32BE(WIDTH,0);header.writeUInt32BE(HEIGHT,4);header[8]=8;header[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))]);
}
