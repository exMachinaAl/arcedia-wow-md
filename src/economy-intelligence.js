/** Tiny local regression on *synthetic* fictional game-market quotes. Never investment advice. */
import {createHash} from 'node:crypto';
const ASSETS={NOVA:42,AQUA:27,ORBI:67};
const dayString=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
export function syntheticQuote(symbol,ms){
 if(!(symbol in ASSETS))return null;
 const d=dayString(ms);
 const h=createHash('sha256').update(`wow-world-synthetic-v1:${symbol}:${d}`).digest();
 return ASSETS[symbol]+h.readUInt16BE(0)%15-7;
}
function predict(series){
 const n=series.length,xAvg=(n-1)/2,yAvg=series.reduce((a,b)=>a+b,0)/n;
 const slope=series.reduce((s,y,x)=>s+(x-xAvg)*(y-yAvg),0)/series.reduce((s,_,x)=>s+(x-xAvg)**2,0);
 return yAvg+slope*(n-xAvg);
}
export function forecast(symbol,now){
 if(!(symbol in ASSETS))return null;
 const DAY=86400000,prices=Array.from({length:28},(_,i)=>syntheticQuote(symbol,now-(27-i)*DAY));
 let baselineError=0,modelError=0;
 for(let i=21;i<28;i++){
   const sample=prices.slice(i-14,i),actual=prices[i];
   baselineError+=Math.abs(actual-prices[i-1]);modelError+=Math.abs(actual-predict(sample));
 }
 baselineError/=7;modelError/=7;
 const chosen=modelError+0.01<baselineError?'linear-regression':'naive-last-price';
 const estimated=chosen==='linear-regression'?predict(prices.slice(-14)):prices.at(-1);
 return {symbol,model:chosen,nextSyntheticEstimate:Math.round(Math.max(1,estimated)),evaluation:{modelMAE:Math.round(modelError*100)/100,baselineMAE:Math.round(baselineError*100)/100},dataSource:'fictional synthetic quotes only',days:28};
}
