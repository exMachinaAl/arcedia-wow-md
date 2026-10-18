import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db.js';
import {createCore,GAMES} from '../src/core.js';
import {createApiKey,listApiKeys,revokeApiKey,verifyApiKey,createDeveloperApi} from '../src/developer/api.js';
import {handleExtension,extensionList,validateExtension} from '../src/developer/extensions.js';
function temp(){const d=mkdtempSync(join(tmpdir(),'waw-dev-'));return {d,cleanup:()=>rmSync(d,{recursive:true,force:true})};}
function ctx(){const {d,cleanup}=temp(),db=openDatabase(':memory:');return {d,db,cleanup(){db.close();cleanup();}};}
function request(api,path,token,method='GET'){
  const req={method,headers:{authorization:token?`Bearer ${token}`:undefined}};
  const response={status:0,payload:null,writeHead(status){this.status=status;},end(s){this.payload=JSON.parse(s);}};
  assert.equal(api(req,response,path),true);
  return response;
}
test('Developer token is hashed at rest, scoped and revocable',()=>{
  const x=ctx();try{
    const file=join(x.d,'keys.json');
    const a=createApiKey('Local Tools',['read:catalog'],file);
    assert.match(a.secret,/^wwd_/);assert.ok(!readFileSync(file,'utf8').includes(a.secret));
    assert.equal(verifyApiKey(a.secret,file).id,a.id);
    assert.equal(listApiKeys(file).length,1);
    assert.equal(revokeApiKey(a.id,file),true);
    assert.equal(verifyApiKey(a.secret,file),null);
  } finally{x.cleanup();}
});
test('Developer API requires bearer auth, enforces scope and read-only routes',()=>{
  const x=ctx();try{
    const file=join(x.d,'keys.json');const a=createApiKey('Read Catalog',['read:catalog'],file);
    const api=createDeveloperApi({db:x.db,keyFile:file});
    assert.equal(request(api,'/api/dev/v1/games',null).status,401);
    assert.equal(request(api,'/api/dev/v1/games','incorrect').status,401);
    const result=request(api,'/api/dev/v1/games',a.secret);
    assert.equal(result.status,200);assert.equal(result.payload.count,GAMES.length);
    assert.equal(request(api,'/api/dev/v1/me',a.secret).status,200);
    assert.equal(request(api,'/api/dev/v1/metrics',a.secret).status,403);
    assert.equal(request(api,'/api/dev/v1/extensions',a.secret).status,403);
    assert.equal(request(api,'/api/dev/v1/games',a.secret,'POST').status,405);
    assert.equal(request(api,'/api/dev/v1/absent',a.secret).status,404);
    assert.equal(api({method:'GET',headers:{}},{},'/api/other'),false);
  } finally{x.cleanup();}
});
test('Developer rate limit and revocation apply without restart',()=>{
  const x=ctx();try{
    const file=join(x.d,'keys.json');const a=createApiKey('Quota Client',['read:metrics'],file);
    let now=1234;const api=createDeveloperApi({db:x.db,keyFile:file,limit:2,clock:()=>now});
    assert.equal(request(api,'/api/dev/v1/metrics',a.secret).status,200);
    assert.equal(request(api,'/api/dev/v1/metrics',a.secret).status,200);
    assert.equal(request(api,'/api/dev/v1/metrics',a.secret).status,429);
    now+=60000;
    assert.equal(request(api,'/api/dev/v1/metrics',a.secret).status,200);
    revokeApiKey(a.id,file);
    assert.equal(request(api,'/api/dev/v1/metrics',a.secret).status,401);
  } finally{x.cleanup();}
});
test('Safe declarative extensions load without executing JavaScript',()=>{
  const x=ctx();try{
    const folder=join(x.d,'extensions');mkdirSync(folder);
    writeFileSync(join(folder,'demo-plugin.json'),JSON.stringify({id:'demo-plugin',name:'Demo',description:'Short help',enabled:true,commands:[{command:'hello',response:'Jawaban statis'}]}));
    assert.equal(handleExtension('.ext list',folder).includes('demo-plugin hello'),true);
    assert.equal(handleExtension('.ext demo-plugin hello',folder),'Jawaban statis');
    assert.equal(handleExtension('.ext demo-plugin invalid',folder),'Command ekstensi tidak ditemukan.');
    assert.equal(extensionList(folder).length,1);
    assert.throws(()=>validateExtension({id:'demo',name:'Danger',description:'',enabled:true,commands:[{command:'x',response:'a',exec:'rm -rf /'}]}));
  } finally{x.cleanup();}
});
test('Core supports .ext hello-world hello, keeps previous wallet idempotency',()=>{
  const x=ctx();try{
    const core=createCore(x.db),before=core.process({senderId:'tester',eventKey:'v10-w',text:'.wallet'});
    assert.match(before,/Saldo: 0/);
    const response=core.process({senderId:'tester',eventKey:'v10-ext',text:'.ext hello-world hello'});
    assert.match(response,/Halo dari ekstensi/);
    assert.equal(core.process({senderId:'tester',eventKey:'v10-ext',text:'.ext hello-world hello'}),response);
  } finally{x.cleanup();}
});
test('Invalid developer scopes and key names rejected',()=>{
  const x=ctx();try{
    const file=join(x.d,'keys.json');
    assert.throws(()=>createApiKey('a',['read:catalog'],file));
    assert.throws(()=>createApiKey('Bad Scope',['write:wallet'],file));
    assert.throws(()=>createApiKey('Bad Duplicate',['read:catalog','read:catalog'],file));
  } finally{x.cleanup();}
});
