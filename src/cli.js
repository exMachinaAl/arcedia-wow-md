import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { openDatabase } from './db.js';
import { createCore } from './core.js';

const db = openDatabase();
const core = createCore(db);
const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: 'you> ' });
console.log('WA-WORLD local simulator. Ketik .menu atau exit. User: demo-player');
rl.prompt();
rl.on('line',(line)=>{
  if (['exit','quit'].includes(line.trim().toLowerCase())) return rl.close();
  try {
    const reply = core.process({senderId:'demo-player',eventKey:`cli:${randomUUID()}`,text:line});
    console.log('world> '+reply);
  } catch (error) { console.error('Gagal:',error.message); }
  rl.prompt();
});
rl.on('close',()=>{db.close();console.log('Bye!');});
