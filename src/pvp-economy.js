/** WOW v1.8 — player-selected match modes and earned, zero-stake PvP rewards.
 * Earned V never comes from another participant. No buy-in, escrow, cash-out, or random stake.
 * All mutations must run inside the core's BEGIN IMMEDIATE transaction.
 */
import {DAY} from './world-economy.js';
export const GAMES=Object.freeze(['chess','snakes','blackjack']);
export const MODES=Object.freeze(['ranked','casual']);
const DEFAULT=Object.freeze({chess:'ranked',snakes:'casual',blackjack:'casual'});
const DAILY_CAP=24,PAIR_CAP=2;
const WIN_REWARD=Object.freeze({chess:12,snakes:8});

export function initPvpEconomy(db){
 db.exec(`
 CREATE TABLE IF NOT EXISTS pvp_preferences (
   user_id TEXT NOT NULL REFERENCES users(id),game TEXT NOT NULL CHECK(game IN ('chess','snakes','blackjack')),
   mode TEXT NOT NULL CHECK(mode IN ('ranked','casual')),PRIMARY KEY(user_id,game)
 );
 CREATE TABLE IF NOT EXISTS pvp_match_modes (
   game TEXT NOT NULL CHECK(game IN ('chess','snakes','blackjack')),match_id TEXT NOT NULL,
   mode TEXT NOT NULL CHECK(mode IN ('ranked','casual')),created_at INTEGER NOT NULL,
   PRIMARY KEY(game,match_id)
 );
 CREATE TABLE IF NOT EXISTS pvp_settlements (
   game TEXT NOT NULL,match_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),
   result TEXT NOT NULL CHECK(result IN ('WIN','LOSE','DRAW','CANCELLED')),
   reward INTEGER NOT NULL DEFAULT 0 CHECK(reward BETWEEN 0 AND 12),created_at INTEGER NOT NULL,
   PRIMARY KEY(game,match_id,user_id)
 );
 CREATE TABLE IF NOT EXISTS pvp_reward_claims (
   game TEXT NOT NULL,match_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),
   opponent_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL,reward INTEGER NOT NULL CHECK(reward>0),
   PRIMARY KEY(game,match_id,user_id)
 );
 CREATE INDEX IF NOT EXISTS idx_pvp_reward_user_day ON pvp_reward_claims(user_id,day);
 CREATE INDEX IF NOT EXISTS idx_pvp_reward_pair ON pvp_reward_claims(user_id,opponent_id,day);
 `);
}

export function createPvpEconomy({db}){
 function currentMode(user,game){
   if(!GAMES.includes(game))throw Error('Invalid PvP game');
   return db.prepare('SELECT mode FROM pvp_preferences WHERE user_id=? AND game=?').get(user,game)?.mode??DEFAULT[game];
 }
 function setMode(user,game,mode){
   if(!GAMES.includes(game)||!MODES.includes(mode))return 'Mode invalid. Gunakan .pvp mode chess|snakes|blackjack ranked|casual';
   if(game==='chess' && (db.prepare("SELECT 1 FROM chess_queue WHERE user_id=?").get(user)||db.prepare("SELECT 1 FROM chess_matches WHERE (white_id=? OR black_id=?) AND status IN ('PENDING','ACTIVE') LIMIT 1").get(user,user)))return 'Selesaikan match atau keluar antrean catur sebelum mengganti mode.';
   if(game==='snakes' && (db.prepare("SELECT 1 FROM match_queue WHERE user_id=?").get(user)||db.prepare("SELECT 1 FROM world_matches WHERE (player_a=? OR player_b=?) AND status IN ('PENDING','ACTIVE') LIMIT 1").get(user,user)))return 'Selesaikan match atau keluar antrean ular tangga sebelum mengganti mode.';
   if(game==='blackjack' && db.prepare("SELECT 1 FROM bj_seats s JOIN bj_rooms r ON r.id=s.room_id WHERE s.user_id=? AND r.status IN ('LOBBY','ACTIVE') LIMIT 1").get(user))return 'Selesaikan ronde blackjack sebelum mengganti mode.';
   db.prepare('INSERT INTO pvp_preferences(user_id,game,mode) VALUES(?,?,?) ON CONFLICT(user_id,game) DO UPDATE SET mode=excluded.mode').run(user,game,mode);
   return `✅ Mode ${game}: ${mode.toUpperCase()}.\nRanked catur/ular tangga: menang sah mendapat V terbatas; Casual tidak mengubah rating/reward PvP.\nBlackjack ranked: statistik saja, tanpa V berbasis hasil kartu.`;
 }
 function modeForMatch(game,id){return db.prepare('SELECT mode FROM pvp_match_modes WHERE game=? AND match_id=?').get(game,id)?.mode??DEFAULT[game];}
 function register(game,id,mode,now){
   if(!GAMES.includes(game)||!MODES.includes(mode))throw Error('Invalid registered game/mode');
   db.prepare('INSERT OR IGNORE INTO pvp_match_modes(game,match_id,mode,created_at) VALUES(?,?,?,?)').run(game,id,mode,now);
   if(modeForMatch(game,id)!==mode)throw Error('Match mode cannot change after pairing');
 }
 function settle({game,id,players,winner=null,completed=false,eligible=false,now=Date.now()}){
   if(!['chess','snakes'].includes(game)||!Array.isArray(players)||players.length!==2||players[0]===players[1])throw Error('Invalid PvP settlement');
   if(players.some(u=>typeof u!=='string'||!db.prepare('SELECT 1 FROM users WHERE id=?').get(u)))throw Error('Unknown PvP player');
   const mode=modeForMatch(game,id),day=DAY(now),payout={};
   // Settlement recorded exactly once per participant even if same result is replayed.
   for(const user of players){
     const old=db.prepare('SELECT reward FROM pvp_settlements WHERE game=? AND match_id=? AND user_id=?').get(game,id,user);
     if(old){payout[user]=old.reward;continue;}
     const result=!completed?'CANCELLED':winner===null?'DRAW':winner===user?'WIN':'LOSE';
     let credited=0;
     if(mode==='ranked'&&eligible&&result==='WIN'){
       const opponent=players.find(p=>p!==user);
       const today=db.prepare('SELECT COALESCE(SUM(reward),0) AS total FROM pvp_reward_claims WHERE user_id=? AND day=?').get(user,day).total;
       const against=db.prepare('SELECT COUNT(*) AS n FROM pvp_reward_claims WHERE user_id=? AND opponent_id=? AND day=?').get(user,opponent,day).n;
       credited=against>=PAIR_CAP?0:Math.max(0,Math.min(WIN_REWARD[game],DAILY_CAP-today));
       if(credited>0){
         const eventKey=`reward:pvp:${game}:${id}:${user}`;
         const ins=db.prepare('INSERT OR IGNORE INTO ledger(user_id,delta,reason,event_key) VALUES(?,?,?,?)').run(user,credited,`pvp-${game}-ranked`,eventKey);
         if(ins.changes!==1)throw Error('PvP ledger mismatch: settlement rolled back');
         db.prepare('UPDATE wallets SET balance=balance+? WHERE user_id=?').run(credited,user);
         db.prepare('INSERT INTO pvp_reward_claims(game,match_id,user_id,opponent_id,day,reward) VALUES(?,?,?,?,?,?)').run(game,id,user,opponent,day,credited);
       }
     }
     db.prepare('INSERT INTO pvp_settlements(game,match_id,user_id,result,reward,created_at) VALUES(?,?,?,?,?,?)').run(game,id,user,result,credited,now);
     payout[user]=credited;
   }
   return payout;
 }
 function recordBlackjack({id,user,result,now}){
   if(!['WIN','BLACKJACK','LOSE','PUSH'].includes(result))throw Error('Bad blackjack result');
   const mapped=['WIN','BLACKJACK'].includes(result)?'WIN':result==='PUSH'?'DRAW':'LOSE';
   db.prepare('INSERT OR IGNORE INTO pvp_settlements(game,match_id,user_id,result,reward,created_at) VALUES(?,?,?,?,0,?)').run('blackjack',id,user,mapped,now);
   // No V from card outcomes. Stats recorded in both modes without monetary incentives.
 }
 function dispatch(user,text){
   if(!/^\.pvp(?:\s|$)/i.test(text))return null;
   const args=text.trim().toLowerCase().split(/\s+/);
   if(args[1]==='mode')return args.length===5?setMode(user,args[2],args[3]):
     args.length===4?setMode(user,args[2],args[3]):'Gunakan .pvp mode chess|snakes|blackjack ranked|casual';
   if(args[1]==='history'){
     const records=db.prepare('SELECT game,match_id,result,reward FROM pvp_settlements WHERE user_id=? ORDER BY created_at DESC, match_id DESC LIMIT 8').all(user);
     return records.length?'📜 Riwayat PvP:\n'+records.map(x=>`${x.game} ${x.match_id}: ${x.result} • +${x.reward} V`).join('\n'):'Belum ada riwayat PvP yang diselesaikan.';
   }
   if(args[1]==='stats'){
     const s=db.prepare('SELECT COUNT(*) AS played,COALESCE(SUM(result=\'WIN\'),0) AS won,COALESCE(SUM(reward),0) AS earned FROM pvp_settlements WHERE user_id=?').get(user);
     const today=db.prepare('SELECT COALESCE(SUM(reward),0) AS earned FROM pvp_reward_claims WHERE user_id=? AND day=?').get(user,DAY(Date.now())).earned;
     return `📊 PvP: ${s.played} selesai • ${s.won} menang • ${s.earned} V diperoleh\nBatas hadiah hari ini: ${today}/${DAILY_CAP} V.\nRiwayat: .pvp history`;
   }
   return `⚔️ WORLD OF WA • MATCH MODES\n♟️ Catur: ${currentMode(user,'chess').toUpperCase()}\n🎲 Ular Tangga: ${currentMode(user,'snakes').toUpperCase()}\n🃏 Blackjack: ${currentMode(user,'blackjack').toUpperCase()} (ranked score only)\n.pvp mode chess ranked|casual\n.pvp mode snakes ranked|casual\n.pvp mode blackjack ranked|casual\n.pvp stats | .pvp history\n🏆 Reward V hanya untuk kemenangan ranked sah Catur/Ular Tangga, maks. ${DAILY_CAP} V/hari & ${PAIR_CAP} kali per lawan/hari. Tanpa taruhan, buy-in, atau transfer hadiah dari lawan.`;
 }
 function stats(){return {rankedMatches:db.prepare("SELECT COUNT(*) n FROM pvp_match_modes WHERE mode='ranked'").get().n,settlements:db.prepare('SELECT COUNT(*) n FROM pvp_settlements').get().n,rewards:db.prepare('SELECT COALESCE(SUM(reward),0) n FROM pvp_reward_claims').get().n};}
 return {currentMode,setMode,modeForMatch,register,settle,recordBlackjack,dispatch,stats};
}
