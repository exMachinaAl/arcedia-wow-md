import {mkdirSync,appendFileSync,writeFileSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const statusFile=resolve('data/wa-gateway-status.json');
const eventsFile=resolve('data/wa-button-tests.jsonl');
// Never store phone numbers, message bodies or session secrets in button diagnostics.
const publicFields=['type','mode','sent','stage','at','outcome','source','buttonId','panel'];
export function setWaStatus(value) {
  mkdirSync(dirname(statusFile),{recursive:true});
  const safe={connection:value.connection,updatedAt:new Date().toISOString(),message:value.message??null};
  writeFileSync(statusFile,JSON.stringify(safe,null,2)+'\n',{mode:0o600});
}
export function recordButtonEvent(event) {
  const safe={};
  for(const k of publicFields) if(event[k]!==undefined) safe[k]=event[k];
  mkdirSync(dirname(eventsFile),{recursive:true});
  appendFileSync(eventsFile,JSON.stringify(safe)+'\n',{mode:0o600});
}
export function getButtonStats() {
  const stats={attempts:0,relayed:0,failed:0,clicked:0,shown:0,hidden:0,clickReports:0,panelAttempts:0,byMode:{}};
  try {
    const lines=readFileSync(eventsFile,'utf8').trim().split('\n').filter(Boolean);
    for(const line of lines) {
      let e;try{e=JSON.parse(line);}catch{continue;}
      if(e.type==='button_attempt') {
        stats.attempts++;
        if(e.sent)stats.relayed++;else stats.failed++;
      }
      if(e.type==='button_click')stats.clicked++;
      if(e.type==='panel_attempt')stats.panelAttempts++;
      if(e.type==='button_feedback'){
        if(e.outcome==='shown')stats.shown++;
        if(e.outcome==='hidden')stats.hidden++;
        if(e.outcome==='clicked')stats.clickReports++;
        const mode=['native','legacy','text'].includes(e.mode)?e.mode:'unspecified';
        if(!stats.byMode[mode])stats.byMode[mode]={shown:0,hidden:0,clicked:0};
        if(['shown','hidden','clicked'].includes(e.outcome))stats.byMode[mode][e.outcome]++;
      }
    }
  }catch { /* no local telemetry yet */ }
  return stats;
}
