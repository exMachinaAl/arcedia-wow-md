/** Server lifecycle guard: prevent two gateways and pause TTL clocks during upgrades.
 * SQL state survives process termination; no dependency on external hosting.
 */
import {randomUUID} from 'node:crypto';
import {inTransaction} from './db.js';
const LEASE_MS=25_000;
export function createRuntime(db,{clock=()=>Date.now(),leaseMs=LEASE_MS}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS runtime_lease (
   id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT,status TEXT NOT NULL CHECK(status IN ('RUNNING','STOPPED')),
   last_seen INTEGER NOT NULL,started_at INTEGER NOT NULL
 );`);
 const owner=randomUUID();let active=false;
 function start(){
  if(active)throw Error('Runtime already started');const now=clock();
  const info=inTransaction(db,()=>{
   const old=db.prepare('SELECT * FROM runtime_lease WHERE id=1').get();
   if(old?.status==='RUNNING'&&now-old.last_seen<leaseMs)throw Error('Gateway already running; stop old WA-START before upgrading');
   const paused=old?Math.max(0,now-old.last_seen):0;
   // Pause only active/pending TTLs. Never reset game state or replay dealt cards.
   if(paused){
    db.prepare('UPDATE chess_queue SET expires_at=expires_at+?').run(paused);
    db.prepare("UPDATE chess_matches SET expires_at=expires_at+? WHERE status IN ('PENDING','ACTIVE')").run(paused);
    db.prepare('UPDATE match_queue SET expires_at=expires_at+?').run(paused);
    db.prepare("UPDATE world_matches SET expires_at=expires_at+? WHERE status IN ('PENDING','ACTIVE')").run(paused);
    db.prepare("UPDATE bj_rooms SET expires_at=expires_at+? WHERE status IN ('LOBBY','ACTIVE')").run(paused);
   }
   db.prepare("INSERT INTO runtime_lease(id,owner,status,last_seen,started_at) VALUES(1,?,'RUNNING',?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,status='RUNNING',last_seen=excluded.last_seen,started_at=excluded.started_at")
    .run(owner,now,now);return {pausedMs:paused,previous:old?.status??'FRESH'};
  });active=true;return info;
 }
 function heartbeat(){if(!active)return false;const res=db.prepare("UPDATE runtime_lease SET last_seen=? WHERE id=1 AND owner=? AND status='RUNNING'").run(clock(),owner);if(res.changes!==1){active=false;throw Error('Lost gateway lease');}return true;}
 function stop(){if(!active)return;db.prepare("UPDATE runtime_lease SET status='STOPPED',last_seen=? WHERE id=1 AND owner=?").run(clock(),owner);active=false;}
 return {start,heartbeat,stop,get active(){return active;}};
}
