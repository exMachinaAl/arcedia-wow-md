import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db.js';
import {createCore} from '../src/core.js';
import {createIntelligence,readModel,predictChessWin} from '../src/intelligence.js';
import {trainChessModel} from '../src/intelligence-training.js';

const fresh=()=>{const db=openDatabase(':memory:');const core=createCore(db);let serial=0;return {db,core,run:(u,text,now=Date.now())=>core.process({senderId:u,eventKey:`test-${++serial}`,text,now})};};

test('Intelligence v1.3: private stats and aggregate no identifiers',()=>{
 const {db,run}=fresh();
 try{
  run('private-number-a','.ping');run('private-number-b','.ping');
  const safe=run('private-number-a','.insights');assert.match(safe,/0 main/);assert.doesNotMatch(safe,/private-number-b/);
  db.prepare("INSERT INTO world_matches(id,game,player_a,player_b,status,accepts,state,created_at,expires_at,completed_at) VALUES('MATCHA','snakes',? ,?,'DONE','[]',?,1,2,3)").run('private-number-a','private-number-b',JSON.stringify({winner:1,turnNo:13}));
  assert.match(run('private-number-a','.insights'),/1 main, 1 menang/);
  assert.match(run('private-number-b','.insights'),/1 main, 0 menang/);
  const global=run('private-number-b','.insights world');assert.match(global,/Ular tangga selesai: 1/);assert.doesNotMatch(global,/private-number-a|private-number-b/);
 }finally{db.close();}
});

test('Intelligence v1.3: chess snapshot uses pre-match rating and is idempotent',()=>{
 const {db,run}=fresh();
 try{
  run('w','.chess join');const join=run('b','.chess join');assert.match(join,/MATCH FOUND/);
  const sample=db.prepare('SELECT * FROM chess_training_samples').get();assert.equal(sample.white_id,'w');assert.equal(sample.black_id,'b');assert.equal(sample.white_rating,1200);assert.equal(sample.black_rating,1200);assert.equal(sample.result,null);
  const ins=createIntelligence({db});ins.snapshot({matchId:sample.match_id,whiteId:'w',blackId:'b',whiteRating:2200,blackRating:1000,now:123});
  assert.equal(db.prepare('SELECT white_rating FROM chess_training_samples').get().white_rating,1200);
  ins.finish(sample.match_id,'w',170);ins.finish(sample.match_id,'b',180);
  assert.equal(db.prepare('SELECT result FROM chess_training_samples').get().result,'w');
 }finally{db.close();}
});

test('Intelligence v1.3: model trainer rejects insufficient data and Elo fallback',()=>{
 assert.equal(trainChessModel([]).status,'INSUFFICIENT_DATA');
 assert.ok(predictChessWin(1400,1000)>0.8);
 const bad=readModel('/does-not-exist/model.json');assert.equal(bad,null);
 const dir=mkdtempSync(join(tmpdir(),'waw-ml-'));
 try{const f=join(dir,'model.json');writeFileSync(f,JSON.stringify({schema:1,status:'APPROVED',feature:'rating_diff_400',weights:[999,2],trainingSamples:90,validation:{baselineBrier:0.4,modelBrier:0.1},trainedAt:new Date().toISOString()}));assert.equal(readModel(f),null);}
 finally{rmSync(dir,{recursive:true,force:true});}
});

test('Intelligence v1.3: model trainer chronological holdout, pair cap, evaluation',()=>{
 const rows=[];let t=0;
 for(let i=0;i<80;i++){
  // White advantage is strong in this generated training sample.
  rows.push({match_id:'M'+i,white_id:'P'+(i%12),black_id:'P'+((i+1+Math.floor(i/12))%12),white_rating:1200,black_rating:1200,created_at:++t,result:i%8===0?'b':'w'});
 }
 const m=trainChessModel(rows);
 assert.equal(m.status,'APPROVED',JSON.stringify(m));
 assert.ok(m.validationSamples>0);assert.ok(Number.isFinite(m.validation.modelBrier));
 assert.ok(m.trainingSamples<=64);
 const shuffled=[...rows].reverse();assert.deepEqual(trainChessModel(shuffled),m);
});

test('Intelligence v1.3: no bonus currency or random manipulation',()=>{
 const {db,run}=fresh();
 try{run('alpha','.ping');const before=db.prepare("SELECT balance FROM wallets WHERE user_id='alpha'").get().balance;
 run('alpha','.insights');run('alpha','.insights world');run('alpha','.model status');
 const after=db.prepare("SELECT balance FROM wallets WHERE user_id='alpha'").get().balance;assert.equal(before,after);
 assert.match(run('alpha','.model status'),/ELO_FALLBACK/);
 }finally{db.close();}
});

test('Intelligence v1.3: completed chess stores approved training label once',()=>{
 const {db,run}=fresh();
 try{
  run('white','.chess join');run('black','.chess join');
  run('white','.chess accept');run('black','.chess accept');
  const moves=[['white','e2e4'],['black','e7e5'],['white','g1f3'],['black','b8c6'],['white','f1c4'],['black','g8f6'],['white','d2d3'],['black','f8c5']];
  for(const [u,m] of moves) assert.match(run(u,'.chess move '+m),/♟️|⛔/);
  assert.equal(db.prepare('SELECT ply FROM chess_matches').get().ply,8);
  assert.match(run('black','.chess resign'),/Menyerah/);
  const row=db.prepare('SELECT result,finished_at FROM chess_training_samples').get();
  assert.equal(row.result,'w');assert.ok(row.finished_at);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM chess_training_samples').get().n,1);
 }finally{db.close();}
});

test('Intelligence v1.3: approved local model loads with validation, no network',()=>{
 const dir=mkdtempSync(join(tmpdir(),'waw-ml-approved-'));
 try{
  const file=join(dir,'model.json');
  const model={status:'APPROVED',schema:1,feature:'rating_diff_400',trainingSamples:40,weights:[0.8,2.1],validation:{modelBrier:0.12,baselineBrier:0.2},trainedAt:new Date().toISOString()};
  writeFileSync(file,JSON.stringify(model));
  assert.equal(readModel(file)?.status,'APPROVED');
  const {db,run}=fresh();
  try{const a=createIntelligence({db,modelPath:file});assert.equal(a.isModelActive,true);assert.ok(a.predict(1400,1200)>a.predict(1000,1200));}
  finally{db.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
