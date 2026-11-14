import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID,randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
const root=fileURLToPath(new URL('../../',import.meta.url));const exec=promisify(execFile);
test('pedidos reais: criação idempotente, transições, aviso bloqueado único, consulta mínima e RLS',async()=>{
 const {stdout}=await exec(path.join(root,'node_modules/.bin/supabase'),['status','-o','json'],{cwd:root,env:{...process.env,SUPABASE_HOME:path.join(root,'.local/supabase-home')}});
 const config=JSON.parse(stdout);assert.ok(['127.0.0.1','localhost'].includes(new URL(config.API_URL).hostname));
 const options={auth:{persistSession:false,autoRefreshToken:false}};const client=()=>createClient(config.API_URL,config.ANON_KEY,options);const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,options);const users=[];const optics=[];
 async function account(){const db=client();const signup=await db.auth.signUp({email:`orders-${randomUUID()}@example.test`,password:randomBytes(24).toString('base64url')});assert.equal(signup.error,null);users.push(signup.data.user.id);const created=await db.rpc('create_optic',{p_name:'Ótica pedidos teste',p_address:'Rua Teste, 120',p_hours:'Das 9h às 18h',p_payments:'Pix e cartões',p_delivery:'Confirme com atendente'});assert.equal(created.error,null);optics.push(created.data);return {db,id:created.data,userId:signup.data.user.id};}
 try{
  const a=await account();const b=await account();const args={p_optic_id:a.id,p_request_id:randomUUID(),p_code:' lum-001 ',p_customer_name:'Cliente fictício privado'};
  const created=await Promise.all([a.db.rpc('create_order',args),a.db.rpc('create_order',args)]);created.forEach(result=>assert.equal(result.error,null));const order=created[0].data;assert.equal(order.id,created[1].data.id);assert.equal(order.code,'LUM-001');assert.equal(order.status,'in_production');
  assert.equal((await a.db.from('order_notifications').select('id')).data.length,0,'Nenhum aviso antes de marcar pronto');
  assert.ok((await a.db.rpc('create_order',{...args,p_customer_name:'Outro nome fictício'})).error);
  assert.ok((await a.db.rpc('create_order',{...args,p_request_id:randomUUID()})).error,'Código único dentro da ótica');
  for(const invalid of ['PED-PESSOA','MENU','A--B','xy'])assert.ok((await a.db.rpc('create_order',{...args,p_request_id:randomUUID(),p_code:invalid})).error);
  const other=await b.db.rpc('create_order',{...args,p_optic_id:b.id,p_request_id:randomUUID()});assert.equal(other.error,null,'Outra ótica pode usar o mesmo código');
  const ready={p_optic_id:a.id,p_order_id:order.id,p_expected_status:'in_production',p_status:'ready'};
  assert.ok((await a.db.rpc('advance_order',{...ready,p_status:'collected'})).error,'Não pula produção direto para retirada');
  const updates=await Promise.all([a.db.rpc('advance_order',ready),a.db.rpc('advance_order',ready)]);updates.forEach(result=>assert.equal(result.error,null));
  const notices=await a.db.from('order_notifications').select('*');assert.equal(notices.error,null);assert.equal(notices.data.length,1);assert.equal(notices.data[0].state,'blocked');assert.equal(notices.data[0].is_demo,true);assert.equal(notices.data[0].template_name,'oculos_prontos');
  const lookup=await a.db.rpc('lookup_order_status',{p_optic_id:a.id,p_code:'lum-001'});assert.equal(lookup.error,null);assert.deepEqual(lookup.data,{code:'LUM-001',status:'ready'},'Consulta não retorna nome, contato ou rascunho');
  assert.deepEqual((await b.db.rpc('lookup_order_status',{p_optic_id:b.id,p_code:'LUM-001'})).data,{code:'LUM-001',status:'in_production'});
  assert.equal((await a.db.rpc('lookup_order_status',{p_optic_id:a.id,p_code:'LUM-404'})).data,null);
  assert.equal((await a.db.rpc('lookup_order_status',{p_optic_id:a.id,p_code:"' OR 1=1"})).data,null);
  assert.ok((await b.db.rpc('lookup_order_status',{p_optic_id:a.id,p_code:'LUM-001'})).error);
  assert.deepEqual((await b.db.from('orders').select('id').eq('id',order.id)).data,[]);assert.deepEqual((await b.db.from('order_notifications').select('id').eq('optic_id',a.id)).data,[]);
  assert.ok((await b.db.rpc('advance_order',ready)).error);assert.ok((await b.db.rpc('list_orders',{p_optic_id:a.id})).error);
  assert.ok((await a.db.from('orders').update({status:'collected'}).eq('id',order.id)).error);assert.ok((await a.db.from('order_notifications').update({state:'sent'}).eq('order_id',order.id)).error);
  assert.ok((await admin.from('order_notifications').update({state:'sent'}).eq('order_id',order.id)).error,'O schema nem permite marcar aviso de teste como enviado');
  assert.ok((await a.db.rpc('advance_order',{...ready,p_status:'collected'})).error,'Tela desatualizada precisa recarregar antes de registrar retirada');
  const collected={...ready,p_expected_status:'ready',p_status:'collected'};assert.equal((await a.db.rpc('advance_order',collected)).error,null);assert.equal((await a.db.rpc('advance_order',collected)).error,null);
  assert.equal((await a.db.from('order_notifications').select('state').single()).data.state,'cancelled');
  assert.ok((await a.db.rpc('advance_order',{...ready,p_expected_status:'collected'})).error,'Não reverte retirada para pronto');
  assert.equal((await a.db.from('order_notifications').select('id')).data.length,1);
  const listed=await a.db.rpc('list_orders',{p_optic_id:a.id});assert.equal(listed.error,null);assert.equal(listed.data[0].notice_state,'cancelled');assert.ok(listed.data[0].ready_at);assert.ok(listed.data[0].collected_at);
  assert.equal((await admin.from('optic_memberships').update({role:'attendant'}).eq('user_id',a.userId)).error,null);
  assert.equal((await a.db.rpc('create_order',{...args,p_request_id:randomUUID(),p_code:'LUM-002'})).error,null,'Atendente vinculado pode registrar pedidos');
  assert.ok((await client().rpc('list_orders',{p_optic_id:a.id})).error);assert.ok((await client().rpc('lookup_order_status',{p_optic_id:a.id,p_code:'LUM-001'})).error);
 }finally{if(optics.length)assert.equal((await admin.from('optics').delete().in('id',optics)).error,null);for(const id of users)assert.equal((await admin.auth.admin.deleteUser(id)).error,null);}
});
