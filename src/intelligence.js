/** WA-WORLD v1.3: private analytics, calibrated chess prediction, transparent Elo fallback.
 * No personal identifiers exported to public APIs or the ML model artifact.
 */
import {existsSync,readFileSync} from 'node:fs';
const DEFAULT_MODEL='data/models/chess-logreg.json';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const sigmoid=x=>1/(1+Math.exp(-clamp(x,-30,30)));
const eloP=diff=>sigmoid(Math.log(10)*diff/400);
export function initIntelligence(db){db.exec(`
 CREATE TABLE IF NOT EXISTS chess_training_samples (
  match_id TEXT PRIMARY KEY REFERENCES chess_matches(id),
  white_id TEXT NOT NULL REFERENCES users(id),black_id TEXT NOT NULL REFERENCES users(id),
  white_rating INTEGER NOT NULL,black_rating INTEGER NOT NULL,
  created_at INTEGER NOT NULL,finished_at INTEGER,result TEXT CHECK(result IN ('w','b','draw')),
  CHECK(white_id<>black_id)
 );
 CREATE INDEX IF NOT EXISTS idx_intelligence_finished ON chess_training_samples(finished_at);
 `);}
export function readModel(path=DEFAULT_MODEL){
 try{
  if(!existsSync(path))return null;
  const m=JSON.parse(readFileSync(path,'utf8'));
  if(m.schema!==1||m.status!=='APPROVED'||m.feature!=='rating_diff_400'||!Array.isArray(m.weights)||m.weights.length!==2||
     !m.weights.every(x=>Number.isFinite(x)&&Math.abs(x)<25)||!Number.isInteger(m.trainingSamples)||m.trainingSamples<24||
     !Number.isFinite(m.validation?.modelBrier)||!Number.isFinite(m.validation?.baselineBrier)||
     m.validation.modelBrier>=m.validation.baselineBrier||!Number.isFinite(Date.parse(m.trainedAt))||Math.abs(Date.now()-Date.parse(m.trainedAt))>90*86400000)return null;
  return m;
 }catch{return null;}
}
export function predictChessWin(whiteRating,blackRating,model=null){
 const diff=clamp((whiteRating-blackRating)/400,-4,4);
 if(!model)return eloP(whiteRating-blackRating);
 return sigmoid(model.weights[0]+model.weights[1]*diff);
}
export function modelInfo(modelPath=DEFAULT_MODEL){const active=readModel(modelPath);return {mode:active?'TRAINED_ML':'ELO_FALLBACK',trainedAt:active?.trainedAt??null,samples:active?.trainingSamples??0};}
export function createIntelligence({db,modelPath=DEFAULT_MODEL}={}){
 const model=readModel(modelPath);
 function snapshot({matchId,whiteId,blackId,whiteRating,blackRating,now}){
  db.prepare('INSERT OR IGNORE INTO chess_training_samples(match_id,white_id,black_id,white_rating,black_rating,created_at) VALUES(?,?,?,?,?,?)').run(matchId,whiteId,blackId,whiteRating,blackRating,now);
 }
 function finish(matchId,result,now){
  if(!['w','b','draw'].includes(result))return;
  db.prepare('UPDATE chess_training_samples SET result=?,finished_at=? WHERE match_id=? AND finished_at IS NULL').run(result,now,matchId);
 }
 function player(user){
  const chess=db.prepare(`SELECT COUNT(*) AS games,
   SUM(CASE WHEN (white_id=? AND json_extract(state,'$.result.winner')='w') OR (black_id=? AND json_extract(state,'$.result.winner')='b') THEN 1 ELSE 0 END) AS wins,
   SUM(CASE WHEN json_extract(state,'$.result.winner') IS NULL THEN 1 ELSE 0 END) AS draws,
   AVG(ply) AS avgPly FROM chess_matches
   WHERE status='DONE' AND (white_id=? OR black_id=?)`).get(user,user,user,user);
  const snakes=db.prepare(`SELECT COUNT(*) AS games,
   SUM(CASE WHEN (player_a=? AND json_extract(state,'$.winner')=1) OR (player_b=? AND json_extract(state,'$.winner')=2) THEN 1 ELSE 0 END) AS wins,
   AVG(COALESCE(json_extract(state,'$.turnNo'),0)) AS avgTurns FROM world_matches
   WHERE status='DONE' AND game='snakes' AND (player_a=? OR player_b=?)`).get(user,user,user,user);
  const pending=db.prepare("SELECT COUNT(*) AS n FROM chess_matches WHERE (white_id=? OR black_id=?) AND status IN ('PENDING','ACTIVE')").get(user,user).n+
   db.prepare("SELECT COUNT(*) AS n FROM world_matches WHERE (player_a=? OR player_b=?) AND status IN ('PENDING','ACTIVE')").get(user,user).n;
  const c=Number(chess.games),s=Number(snakes.games);
  return {chess:{games:c,wins:Number(chess.wins??0),draws:Number(chess.draws??0),losses:c-Number(chess.wins??0)-Number(chess.draws??0),averagePly:Math.round(chess.avgPly??0)},snakes:{games:s,wins:Number(snakes.wins??0),losses:s-Number(snakes.wins??0),averageTurns:Math.round(snakes.avgTurns??0)},activeMatches:pending};
 }
 function global(){
  const c=db.prepare("SELECT COUNT(*) n,COALESCE(AVG(ply),0) avgPly FROM chess_matches WHERE status='DONE'").get();
  const s=db.prepare("SELECT COUNT(*) n,COALESCE(AVG(json_extract(state,'$.turnNo')),0) avgTurns FROM world_matches WHERE status='DONE' AND game='snakes'").get();
  const rated=db.prepare('SELECT COUNT(*) n FROM chess_training_samples WHERE result IS NOT NULL').get().n;
  return {chessCompleted:c.n,snakesCompleted:s.n,chessAveragePly:Math.round(c.avgPly),snakesAverageTurns:Math.round(s.avgTurns),trainingSamples:rated,matchmaker:modelInfo(modelPath)};
 }
 function perform(user,text){
  if(!/^\.(insights|model)(?:\s|$)/i.test(text))return null;
  const arg=text.trim().toLowerCase();
  if(arg==='.model'||arg==='.model status'||arg==='.insights model'){
   const s=global();return `🧠 Matchmaking: ${s.matchmaker.mode}\nDataset selesai: ${s.trainingSamples} pertandingan catur.\nModel dilatih offline melalui ML-TRAIN.bat (bila data memenuhi syarat). Tidak memengaruhi RNG game.`;
  }
  if(arg==='.insights world'){
   const s=global();return `🌍 Statistik Arena (agregat)\n♟️ Catur selesai: ${s.chessCompleted} · rata-rata ${s.chessAveragePly} ply\n🎲 Ular tangga selesai: ${s.snakesCompleted} · rata-rata ${s.snakesAverageTurns} giliran\nMatchmaking: ${s.matchmaker.mode}`;
  }
  if(arg==='.insights'||arg==='.insights me'||arg==='.insights stats'){
   const s=player(user);return `📊 Statistik PvP kamu (privat)\n♟️ Catur: ${s.chess.games} main, ${s.chess.wins} menang, ${s.chess.draws} seri, ${s.chess.losses} kalah\n🎲 Ular Tangga: ${s.snakes.games} main, ${s.snakes.wins} menang\nPertandingan aktif/pending: ${s.activeMatches}\n.insights world | .model status`;
  }
  return 'Gunakan .insights | .insights world | .model status';
 }
 return {snapshot,finish,player,global,perform,predict:(a,b)=>predictChessWin(a,b,model),isModelActive:!!model};
}
