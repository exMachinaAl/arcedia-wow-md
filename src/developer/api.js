/** Local-first scoped developer API; secrets live only in data/dev-keys.json. */
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,mkdirSync,renameSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {GAMES} from '../core.js';
import {extensionList} from './extensions.js';
export const SCOPES=Object.freeze(['read:catalog','read:metrics','read:extensions']);
const HASH = s=>createHash('sha256').update(s).digest('hex');
const defaultFile=()=>resolve(process.env.WA_DEV_KEYS_PATH??'./data/dev-keys.json');
function load(file=defaultFile()){
  if(!existsSync(file))return {schema:1,keys:[]};
  const data=JSON.parse(readFileSync(file,'utf8'));
  if(data.schema!==1||!Array.isArray(data.keys))throw Error('Invalid developer key store');
  return data;
}
function save(file,data){mkdirSync(dirname(file),{recursive:true});const tmp=`${file}.tmp-${process.pid}`;writeFileSync(tmp,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});renameSync(tmp,file);}
export function createApiKey(name,scopes=SCOPES,file=defaultFile()){
  if(typeof name!=='string'||!/^[A-Za-z0-9 _-]{3,35}$/.test(name))throw Error('Invalid key name');
  if(!Array.isArray(scopes)||scopes.length<1||new Set(scopes).size!==scopes.length||scopes.some(x=>!SCOPES.includes(x)))throw Error('Invalid scopes');
  const data=load(file);
  if(data.keys.filter(k=>!k.revokedAt).length>=20)throw Error('Max 20 active keys');
  const id=randomBytes(6).toString('hex'),secret='wwd_'+randomBytes(32).toString('base64url');
  data.keys.push({id,name,scopes,hash:HASH(secret),createdAt:new Date().toISOString(),revokedAt:null});
  save(file,data);return {id,secret};
}
export function listApiKeys(file=defaultFile()){
  return load(file).keys.map(({id,name,scopes,createdAt,revokedAt})=>({id,name,scopes,createdAt,revokedAt}));
}
export function revokeApiKey(id,file=defaultFile()){
  const data=load(file),entry=data.keys.find(k=>k.id===id&&!k.revokedAt);
  if(!entry)return false;
  entry.revokedAt=new Date().toISOString();save(file,data);return true;
}
export function verifyApiKey(token,file=defaultFile()){
  if(typeof token!=='string'||!/^wwd_[A-Za-z0-9_-]{40,50}$/.test(token))return null;
  const digest=Buffer.from(HASH(token),'hex');
  for(const entry of load(file).keys){
    if(entry.revokedAt||!/^[a-f0-9]{64}$/.test(entry.hash))continue;
    if(timingSafeEqual(digest,Buffer.from(entry.hash,'hex')))return {id:entry.id,name:entry.name,scopes:entry.scopes};
  }
  return null;
}
export function createDeveloperApi({db,keyFile=defaultFile(),extensionsDir,clock=Date.now,limit=60}={}){
  if(!db)throw Error('Database required');
  const windows=new Map();
  return function handle(req,res,path){
    if(!path.startsWith('/api/dev/v1/'))return false;
    const json=(status,payload)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));};
    if(req.method!=='GET'){json(405,{error:'METHOD_NOT_ALLOWED'});return true;}
    const header=req.headers.authorization??'';
    const match=/^Bearer (wwd_[A-Za-z0-9_-]+)$/.exec(header);
    let caller=null;
    try{caller=match?verifyApiKey(match[1],keyFile):null;}catch{json(503,{error:'KEY_STORE_UNAVAILABLE'});return true;}
    if(!caller){json(401,{error:'UNAUTHORIZED'});return true;}
    const now=clock(),bucket=windows.get(caller.id);
    if(!bucket||now-bucket.start>=60000)windows.set(caller.id,{start:now,count:1});
    else if(++bucket.count>limit){json(429,{error:'RATE_LIMITED',retryAfterSeconds:Math.max(1,Math.ceil((60000-(now-bucket.start))/1000))});return true;}
    const endpoints={
      '/api/dev/v1/me':null,
      '/api/dev/v1/games':'read:catalog',
      '/api/dev/v1/metrics':'read:metrics',
      '/api/dev/v1/extensions':'read:extensions'
    };
    if(!Object.hasOwn(endpoints,path)){json(404,{error:'NOT_FOUND'});return true;}
    const required=endpoints[path];
    if(required&&!caller.scopes.includes(required)){json(403,{error:'FORBIDDEN',requiredScope:required});return true;}
    if(path==='/api/dev/v1/me')json(200,{id:caller.id,name:caller.name,scopes:caller.scopes});
    else if(path==='/api/dev/v1/games')json(200,{count:GAMES.length,games:GAMES.map(({id,name,command,status})=>({id,name,command,status}))});
    else if(path==='/api/dev/v1/extensions'){
      try{json(200,{extensions:extensionList(extensionsDir)});}catch{json(503,{error:'EXTENSION_REGISTRY_UNAVAILABLE'});}
    }
    else {
      const users=db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
      const rounds=db.prepare('SELECT COALESCE(SUM(plays),0) AS n FROM player_stats').get().n;
      json(200,{users,rounds,gameCount:GAMES.length});
    }
    return true;
  };
}
