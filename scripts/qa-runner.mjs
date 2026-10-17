import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {GAMES} from '../src/core.js';
import {PANELS,BUTTON_COMMANDS,nativeRelayNodes} from '../src/wa/buttons.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(readFileSync(join(root,'qa','features.json'),'utf8'));
const liveFile=join(root,'data','qa-live-results.json'),output=join(root,'data','qa-report.json');
let live={};try{live=JSON.parse(readFileSync(liveFile,'utf8'));}catch{}
const auto={};
const tests=readdirSync(join(root,'tests')).filter(x=>x.endsWith('.test.js')).map(x=>join(root,'tests',x));
const run=spawnSync(process.execPath,['--experimental-sqlite','--test',...tests],{cwd:root,encoding:'utf8',timeout:90000,maxBuffer:3_000_000});
const transcript=String(run.stdout??'')+String(run.stderr??'');
const match=transcript.match(/# tests (\d+)[\s\S]*?# pass (\d+)[\s\S]*?# fail (\d+)/);
const testCounts=match?{total:Number(match[1]),passed:Number(match[2]),failed:Number(match[3])}:{total:0,passed:0,failed:0};
const testsGood=run.status===0&&testCounts.total>=35&&testCounts.failed===0;
auto.AUTO_TESTS=[testsGood,`${testCounts.passed}/${testCounts.total} tes lulus; exit=${run.status??run.signal}`];
auto.AUTO_DATABASE=[testsGood&&transcript.includes('legacy')&&transcript.includes('mission'), 'Regression SQLite, duplicate event, misi dan migrasi'];
auto.AUTO_GAMES=[testsGood&&GAMES.length===16&&transcript.includes('Game Pack'), `${GAMES.length} game terdaftar; sesi dan reward diuji`];
auto.AUTO_BUTTONS=[testsGood&&Object.keys(PANELS).length>=8&&Object.keys(BUTTON_COMMANDS).length>=20&&nativeRelayNodes('test@s.whatsapp.net')[0].tag==='biz','Allowlist native-flow dan 3-button panels'];
auto.AUTO_PATCH=[existsSync(join(root,'scripts','merge-updater.mjs'))&&existsSync(join(root,'preview-update.bat'))&&existsSync(join(root,'rollback-update.bat')),'Keberadaan updater; staging installer diuji terpisah oleh pembuat paket'];
const csv=readFileSync(join(root,'docs','GAME_CATALOG.csv'),'utf8').trim().split(/\r?\n/);
auto.AUTO_CATALOG=[csv.length>=101&&existsSync(join(root,'project','tracker.json'))&&new Set(GAMES.map(x=>x.id)).size===GAMES.length,`Katalog ${csv.length-1} ide; ${GAMES.length} playable`];
const checks=catalog.checks.map(c=>{
  if(c.method==='AUTO'){const [ok,detail]=auto[c.id]??[false,'No implementation'];return {...c,status:ok?'PASS':'FAIL',source:'automated',detail};}
  const item=live[c.id]??{};return {...c,status:['PASS','FAIL'].includes(item.status)?item.status:'PENDING_LIVE',source:'user-reported',detail:item.note??c.instructions,updatedAt:item.updatedAt??null};
});
const gate=(xs)=>xs.some(x=>x.status==='FAIL')?'FAIL':xs.every(x=>x.status==='PASS')?'PASS':'PENDING';
const result={release:catalog.release,generatedAt:new Date().toISOString(),testCounts,offlineGate:gate(checks.filter(c=>c.flag==='WAJIB'&&c.method==='AUTO')),liveGate:gate(checks.filter(c=>c.flag==='WAJIB'&&c.method==='LIVE')),checks,
  message:'AUTO PASS does not confirm a WhatsApp button rendered or that pairing succeeded. LIVE values are user-reported.'};
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(`\nWA-WORLD QA ${result.release} | ${testCounts.passed}/${testCounts.total} automated tests`);
console.log(`OFFLINE GATE: ${result.offlineGate} | LIVE GATE: ${result.liveGate}`);
for(const c of checks)console.log(`${c.flag.padEnd(8)} ${c.method.padEnd(5)} ${c.status.padEnd(12)} ${c.id} — ${c.name}`);
console.log('\nReport: data/qa-report.json (local only)');
console.log('Status PENDING_LIVE bukan error. Jalankan QA-LIVE-RECORD.bat untuk tiga cek WAJIB di HP.');
if(result.offlineGate!=='PASS')process.exitCode=1;
