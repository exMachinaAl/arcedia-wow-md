import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.js';
import { GAMES } from './core.js';
import { getButtonStats } from './wa/telemetry.js';

const here=dirname(fileURLToPath(import.meta.url));
const trackerPath=join(here,'..','project','tracker.json');
const historyPath=join(here,'..','.wa-world','history.json');
const catalogPath=join(here,'..','docs','GAME_CATALOG.csv');
const catalog=readFileSync(catalogPath,'utf-8').trim().split('\n').length-1;
const html=readFileSync(join(here,'..','public','index.html'));
const db=openDatabase();
const host=process.env.HOST || '127.0.0.1';
const port=Number(process.env.PORT || 3000);
const server=createServer((req,res)=>{
  const path=(req.url || '/').split('?')[0];
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'");
  if(req.method==='GET' && path==='/api/status') {
    const tracker=JSON.parse(readFileSync(trackerPath,'utf-8'));
    let updateHistory=[];
    try { updateHistory=JSON.parse(readFileSync(historyPath,'utf-8')).map(h=>({before:h.before,after:h.after,status:h.status,installedAt:h.installedAt})).slice(-12); } catch { /* full starter has no patch history */ }
    let waStatus={connection:'not-started'};
    try {waStatus=JSON.parse(readFileSync(join(here,'..','data','wa-gateway-status.json'),'utf-8'));} catch {}
    const buttons=getButtonStats();
    let qa=null;
    try {qa=JSON.parse(readFileSync(join(here,'..','data','qa-report.json'),'utf8'));}catch{}

    const count=db.prepare('SELECT count(*) AS n FROM users').get().n;
    const total=db.prepare('SELECT coalesce(sum(balance),0) AS n FROM wallets').get().n;
    const claims=db.prepare('SELECT COUNT(*) AS n FROM daily_claims').get().n;
    const ranked=db.prepare('SELECT COUNT(*) AS n FROM player_stats WHERE ranked=1').get().n;
    const xp=db.prepare('SELECT COALESCE(SUM(xp),0) AS n FROM player_stats').get().n;
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify({project:tracker.project,version:tracker.version,phase:tracker.phase,milestones:tracker.milestones,tasks:tracker.tasks,updateHistory,
      taskCounts:{total:tracker.tasks.length,done:tracker.tasks.filter(t=>t.status==='DONE').length,inProgress:tracker.tasks.filter(t=>t.status==='IN_PROGRESS').length},
      games:{target:100,catalog,playable:GAMES.length},users:count,virtualCurrencyIssued:total,dailyClaims:claims,rankedPlayers:ranked,totalXP:xp,waStatus,buttonStats:buttons,qa,
      notes:'Metrics local prototype only. v0.4 interactive panels user-reported working; v0.5 QA live checks remain pending until confirmed. AI not implemented.'}));
  } else if(req.method==='GET' && (path==='/app.js' || path==='/style.css')) {
    res.setHeader('Content-Type',path==='/app.js' ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8');
    res.end(readFileSync(join(here,'..','public',path.slice(1))));
  } else if(req.method==='GET' && path==='/') {
    res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(html);
  } else if(req.method==='GET' && path==='/health') {
    const tracker=JSON.parse(readFileSync(trackerPath,'utf-8'));
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,version:tracker.version}));
  } else { res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Not found'})); }
});
server.listen(port,host,()=>console.log(`WA-WORLD dashboard → http://${host}:${port} (read-only)`));
const shutdown=()=>{server.close(()=>{db.close();process.exit(0);});};
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
