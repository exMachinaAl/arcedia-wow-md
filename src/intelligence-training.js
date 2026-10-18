/** Optional local logistic regression. Eligibility & holdout validation prevent premature ML activation. */
import {predictChessWin} from './intelligence.js';
const sigmoid=z=>1/(1+Math.exp(-Math.max(-30,Math.min(30,z))));
const brier=(rows,fn)=>rows.reduce((acc,r)=>acc+(fn(r)-r.y)**2,0)/rows.length;
export function trainChessModel(rows,{minSamples=30,minUsers=8}={}){
 const seenPairs=new Map(),usable=[],people=new Set();
 for(const row of [...rows].sort((a,b)=>a.created_at-b.created_at||String(a.match_id).localeCompare(String(b.match_id)))){
  if(!['w','b'].includes(row.result)||!Number.isFinite(row.white_rating)||!Number.isFinite(row.black_rating)||row.white_id===row.black_id)continue;
  const pair=[row.white_id,row.black_id].sort().join('|');const c=seenPairs.get(pair)??0;
  if(c>=3)continue;seenPairs.set(pair,c+1);
  people.add(row.white_id);people.add(row.black_id);
  usable.push({x:Math.max(-4,Math.min(4,(row.white_rating-row.black_rating)/400)),y:Number(row.result==='w')});
 }
 if(usable.length<minSamples||people.size<minUsers||usable.filter(x=>x.y===1).length<8||usable.filter(x=>x.y===0).length<8)
  return {status:'INSUFFICIENT_DATA',samples:usable.length,uniquePlayers:people.size,minSamples,minUsers};
 const n=Math.floor(usable.length*0.8),train=usable.slice(0,n),valid=usable.slice(n);
 let b=0,w=2.3;
 for(let epoch=0;epoch<1200;epoch++){
  let gb=0,gw=0;
  for(const r of train){const err=sigmoid(b+w*r.x)-r.y;gb+=err;gw+=err*r.x;}
  // L2 penalty, except intercept; bounded to avoid overflow and overfitting.
  const lr=0.06;b-=lr*gb/train.length;w-=lr*(gw/train.length+0.03*w);
 }
 const baselineBrier=brier(valid,r=>predictChessWin(r.x*400,0));
 const modelBrier=brier(valid,r=>sigmoid(b+w*r.x));
 const approved=modelBrier+0.005<baselineBrier;
 return {status:approved?'APPROVED':'BASELINE_BETTER',schema:1,feature:'rating_diff_400',trainingSamples:train.length,validationSamples:valid.length,
  weights:[Number(b.toFixed(6)),Number(w.toFixed(6))],validation:{modelBrier:Number(modelBrier.toFixed(6)),baselineBrier:Number(baselineBrier.toFixed(6))}};
}
