import {createWorldSocial} from './world-social.js';
import {createWorldMarket} from './world-market.js';
import {createWorldAdaptive} from './world-adaptive.js';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.js';
import { GAMES } from './core.js';
import {createMultiplayer} from './multiplayer.js';
import {createChess} from './chess.js';
import {createBlackjack} from './blackjack.js';
import {createInventory} from './inventory.js';
import {createWorldIntelligence} from './world-intelligence.js';
import {createWorldCommunity} from './world-community.js';
import {createArcade} from './arcade.js';
import {createWorldEconomy} from './world-economy.js';
import {createWorldLifecycle} from './world-lifecycle.js';
import {createPvpEconomy} from './pvp-economy.js';
import {createIntelligence} from './intelligence.js';
import { getButtonStats } from './wa/telemetry.js';
import { createDeveloperApi,listApiKeys } from './developer/api.js';
import { extensionList } from './developer/extensions.js';

const here=dirname(fileURLToPath(import.meta.url));
const trackerPath=join(here,'..','project','tracker.json');
const historyPath=join(here,'..','.wa-world','history.json');
const catalogPath=join(here,'..','docs','GAME_CATALOG.csv');
const catalog=readFileSync(catalogPath,'utf-8').trim().split('\n').length-1;
const html=readFileSync(join(here,'..','public','index.html'));
const db=openDatabase();
const devApi=createDeveloperApi({db});
const mpStats=createMultiplayer({db});
const intelligence=createIntelligence({db});
const chessStats=createChess({db,intelligence});
const blackjack=createBlackjack({db});
const inventory=createInventory({db});
const worldIntelligence=createWorldIntelligence({db});
const community=createWorldCommunity({db});
const market22=createWorldMarket({db});
const adaptive=createWorldAdaptive({db});
const worldSocial=createWorldSocial({db,community});
const arcade=createArcade({db});
const world=createWorldEconomy({db,credit:()=>0});
const lifecycle=createWorldLifecycle({db});
const pvp=createPvpEconomy({db});
const host=process.env.HOST || '127.0.0.1';
const port=Number(process.env.PORT || 3000);
const server=createServer((req,res)=>{
  const path=(req.url || '/').split('?')[0];
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'");
  if(devApi(req,res,path))return;
  if(req.method==='GET' && path==='/api/status') {
    const tracker=JSON.parse(readFileSync(trackerPath,'utf-8'));
    let updateHistory=[];
    try { updateHistory=JSON.parse(readFileSync(historyPath,'utf-8')).map(h=>({before:h.before,after:h.after,status:h.status,installedAt:h.installedAt})).slice(-12); } catch { /* full starter has no patch history */ }
    let waStatus={connection:'not-started'};
    try {waStatus=JSON.parse(readFileSync(join(here,'..','data','wa-gateway-status.json'),'utf-8'));} catch {}
    const buttons=getButtonStats();
    let qa=null;
    try {qa=JSON.parse(readFileSync(join(here,'..','data','qa-report.json'),'utf8'));if(qa.release!==tracker.version)qa=null;}catch{}

    const count=db.prepare('SELECT count(*) AS n FROM users').get().n;
    const total=db.prepare('SELECT coalesce(sum(balance),0) AS n FROM wallets').get().n;
    const claims=db.prepare('SELECT COUNT(*) AS n FROM daily_claims').get().n;
    const ranked=db.prepare('SELECT COUNT(*) AS n FROM player_stats WHERE ranked=1').get().n;
    const xp=db.prepare('SELECT COALESCE(SUM(xp),0) AS n FROM player_stats').get().n;
    const aiConsents=db.prepare('SELECT COUNT(*) AS n FROM ai_preferences WHERE consent=1').get().n;
    const aiCalls=db.prepare('SELECT COUNT(*) AS n FROM ai_calls').get().n;
    const friendshipCount=db.prepare('SELECT COUNT(*) AS n FROM friendships').get().n;
    const activeDuels=db.prepare("SELECT COUNT(*) AS n FROM duels WHERE status IN ('INVITED','ACTIVE') AND expires_at>?").get(Date.now()).n;
    const totalTransfers=db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS value FROM transfers').get();
    let developer={activeKeys:0,extensions:0,registryHealthy:true};
    try{developer.activeKeys=listApiKeys().filter(k=>!k.revokedAt).length;developer.extensions=extensionList().filter(e=>e.enabled).length;}catch{developer.registryHealthy=false;}
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify({project:tracker.project,version:tracker.version,phase:tracker.phase,milestones:tracker.milestones,tasks:tracker.tasks,updateHistory,
      taskCounts:{total:tracker.tasks.length,done:tracker.tasks.filter(t=>t.status==='DONE').length,inProgress:tracker.tasks.filter(t=>t.status==='IN_PROGRESS').length},
      games:{target:100,catalog,playable:GAMES.length},multiplayer:mpStats.stats(),chess:chessStats.stats(),blackjack:blackjack.stats(),inventory:inventory.stats(),worldIntelligence:worldIntelligence.worldStats(),community:community.stats(),worldSocial:worldSocial.stats(),adaptive:adaptive.stats(),season:adaptive.seasonInfo(Date.now()),dailyMarket:market22.stats(),adaptive:adaptive.stats(),currentSeason:adaptive.seasonInfo(Date.now()),worldEvent:worldIntelligence.event(Date.now()),arcade:arcade.stats(),world:world.stats(),lifecycle:lifecycle.stats(),pvp:pvp.stats(),intelligence:intelligence.global(),users:count,virtualCurrencyIssued:total,dailyClaims:claims,rankedPlayers:ranked,totalXP:xp,ai:{consentingPlayers:aiConsents,successfulCalls:aiCalls,mode:"Optional local Ollama; OFF by default"},social:{friendships:friendshipCount,activeDuels,transferCount:totalTransfers.n,transferVolume:totalTransfers.value},developer,waStatus,buttonStats:buttons,qa,
      notes:'v2.4 guild group linking/admin verification, guild rally, public world pulse and activity reputation; v2.3 season challenges and guild supplies active; auction auto-expiry and heuristic risk checks; v2.2 shop active, experimental material auction disabled by default; v2.1 guild/property (nontransferable V); v2.0 WOW world event + opt-in online recommender; v1.9 lifecycle kept: V-only shop, crafting, careers, simulated stake-based V arcade with consent/caps; no top-up, transfer or cash-out. Live test and policy review pending.'}));
  } else if(req.method==='GET' && path==='/api/v1/world') {
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify({version:'2.4.1',community:community.stats(),worldSocial:worldSocial.stats(),adaptive:adaptive.stats(),season:adaptive.seasonInfo(Date.now()),dailyMarket:market22.stats(),event:worldIntelligence.event(Date.now()),stats:worldIntelligence.worldStats(),privacy:'aggregate only'}));
  } else if(req.method==='GET' && path==='/api/v1/world-social') {
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify({version:'2.4.1',worldSocial:worldSocial.stats(),community:community.stats(),privacy:'aggregate; no group JIDs or player IDs'}));
  } else if(req.method==='GET' && path==='/api/v1/dailyshop') {
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify({version:'2.4.1',offers:market22.shopOffers(Date.now()),market:market22.stats(),privacy:'aggregate only; auction disabled by default'}));
  } else if(req.method==='GET' && path==='/api/v1/games') {
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify({version:JSON.parse(readFileSync(trackerPath,'utf8')).version,total:GAMES.length,target:100,games:GAMES.map(({id,name,command,status})=>({id,name,command,status}))}));
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
