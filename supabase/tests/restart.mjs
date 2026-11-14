import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const exec=promisify(execFile);
const root=fileURLToPath(new URL('../../',import.meta.url));
async function status() {
 const {stdout}=await exec(path.join(root,'node_modules/.bin/supabase'),['status','-o','json'],{cwd:root,env:{...process.env,SUPABASE_HOME:path.join(root,'.local/supabase-home')}});
 const config=JSON.parse(stdout);
 assert.ok(['127.0.0.1','localhost'].includes(new URL(config.API_URL).hostname));
 return config;
}
const options={auth:{persistSession:false,autoRefreshToken:false}};

test('parar e iniciar Supabase local preserva conta e configuração da ótica', async () => {
 let config=await status();
 let db=createClient(config.API_URL,config.ANON_KEY,options);
 const email=`restart-${randomUUID()}@example.test`; const password=randomBytes(24).toString('base64url');
 const signup=await db.auth.signUp({email,password});
 assert.equal(signup.error,null);
 const userId=signup.data.user.id; let opticId;
 try {
  const saved=await db.rpc('create_optic',{p_name:'Ótica retomada',p_address:'Rua Teste, 12',p_hours:'Das 9h às 18h',p_payments:'Pix e cartões',p_delivery:'Confirmar com atendente'});
  assert.equal(saved.error,null); opticId=saved.data;
  // Use only the repository helper; no reset, volume deletion, or remote command.
  await exec(process.execPath,['scripts/local-supabase.mjs','stop'],{cwd:root});
  await exec(process.execPath,['scripts/local-supabase.mjs','start'],{cwd:root});
  config=await status();
  db=createClient(config.API_URL,config.ANON_KEY,options);
  assert.equal((await db.auth.signInWithPassword({email,password})).error,null);
  const restored=await db.from('optics').select('id,name').single();
  assert.equal(restored.error,null); assert.equal(restored.data.id,opticId); assert.equal(restored.data.name,'Ótica retomada');
 } finally {
  const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,options);
  if(opticId) assert.equal((await admin.from('optics').delete().eq('id',opticId)).error,null);
  assert.equal((await admin.auth.admin.deleteUser(userId)).error,null);
 }
});
