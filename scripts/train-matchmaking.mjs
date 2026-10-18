import {mkdirSync,writeFileSync} from 'node:fs';
import {openDatabase} from '../src/db.js';
import {trainChessModel} from '../src/intelligence-training.js';
const db=openDatabase();
try{
 const data=db.prepare("SELECT match_id,white_id,black_id,white_rating,black_rating,created_at,result FROM chess_training_samples WHERE result IN ('w','b') ORDER BY created_at,match_id").all();
 const result=trainChessModel(data);
 console.log('WA-WORLD CHESS ML TRAINER');console.log(JSON.stringify(result,null,2));
 if(result.status!=='APPROVED'){console.log('Elo fallback tetap aktif. Model lama tidak diubah.');process.exitCode=0;}
 else{
  mkdirSync('data/models',{recursive:true});
  const fs=await import('node:fs');const name='data/models/chess-logreg.json';
  fs.writeFileSync(name+'.tmp',JSON.stringify({...result,trainedAt:new Date().toISOString()},null,2)+'\n');fs.renameSync(name+'.tmp',name);
  console.log('Model disimpan. Restart gateway agar model dibaca. Tidak pernah mengirim data ke luar komputer.');
 }
}finally{db.close();}
