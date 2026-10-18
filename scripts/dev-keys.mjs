#!/usr/bin/env node
import {createApiKey,listApiKeys,revokeApiKey,SCOPES} from '../src/developer/api.js';
const [operation,...args]=process.argv.slice(2);
try{
  if(operation==='create'){
    const [name,...scopes]=args;
    const result=createApiKey(name,scopes.length?scopes:SCOPES);
    console.log(`API key ID: ${result.id}\nTOKEN (HANYA DITAMPILKAN SEKALI): ${result.secret}\nSimpan rahasia ini dengan aman. Jangan kirim ke ChatGPT atau commit ke GitHub.`);
  } else if(operation==='list')console.log(JSON.stringify(listApiKeys(),null,2));
  else if(operation==='revoke')console.log(revokeApiKey(args[0])?'REVOKED':'KEY_NOT_FOUND');
  else {console.log('Usage: node scripts/dev-keys.mjs create "Nama Aplikasi" [read:catalog read:metrics read:extensions] | list | revoke <id>');process.exitCode=1;}
}catch(e){console.error('Developer key error:',e.message);process.exitCode=1;}
