import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID,randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
const root=fileURLToPath(new URL('../../',import.meta.url));const exec=promisify(execFile);
test('agenda da conversa: agrupamento de sessão, RLS, reenvio e mutações restritas ao contexto',async()=>{
 const {stdout}=await exec(path.join(root,'node_modules/.bin/supabase'),['status','-o','json'],{cwd:root,env:{...process.env,SUPABASE_HOME:path.join(root,'.local/supabase-home')}});
 const config=JSON.parse(stdout);assert.ok(['127.0.0.1','localhost'].includes(new URL(config.API_URL).hostname));
 const options={auth:{persistSession:false,autoRefreshToken:false}};const client=()=>createClient(config.API_URL,config.ANON_KEY,options);const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,options);
 const users=[];const optics=[];
 async function account(){const db=client();const signup=await db.auth.signUp({email:`chat-agenda-${randomUUID()}@example.test`,password:randomBytes(24).toString('base64url')});assert.equal(signup.error,null);users.push(signup.data.user.id);const created=await db.rpc('create_optic',{p_name:'Ótica conversa teste',p_address:'Rua de teste, 120',p_hours:'Das 9h às 18h',p_payments:'Pix e cartões',p_delivery:'Confirme com atendente'});assert.equal(created.error,null);optics.push(created.data);return{db,id:created.data};}
 try{
  const a=await account();const b=await account();const session=randomUUID();const another=randomUUID();const slots=[];
  for(let i=0;i<4;i++){const result=await a.db.rpc('create_appointment_slot',{p_optic_id:a.id,p_starts_at:new Date(Date.now()+(48+i)*3600000).toISOString(),p_duration_minutes:30,p_service:i===3?'adjustment':'exam'});assert.equal(result.error,null);slots.push(result.data.id);}
  const manualArgs={p_optic_id:a.id,p_slot_id:slots[0],p_request_id:randomUUID(),p_customer_name:'Reserva manual fictícia'};
  const manual=await a.db.rpc('book_appointment',manualArgs);assert.equal(manual.error,null);
  assert.ok((await a.db.rpc('book_conversation_appointment',{...manualArgs,p_simulation_id:session})).error,'Não pode reassociar reserva manual usando uma chave já existente');
  assert.equal((await a.db.from('appointments').select('simulation_id').eq('id',manual.data.id).single()).data.simulation_id,null);
  const args={p_optic_id:a.id,p_simulation_id:session,p_slot_id:slots[1],p_request_id:randomUUID(),p_customer_name:'Cliente de teste da conversa'};
  const booked=await a.db.rpc('book_conversation_appointment',args);assert.equal(booked.error,null);assert.equal(booked.data.simulation_id,session);
  const retry=await a.db.rpc('book_conversation_appointment',args);assert.equal(retry.error,null);assert.equal(retry.data.id,booked.data.id);
  assert.ok((await a.db.rpc('book_conversation_appointment',{...args,p_simulation_id:another})).error,'Não pode transferir reserva para outra simulação');
  const current=await a.db.rpc('get_conversation_agenda',{p_optic_id:a.id,p_simulation_id:session});assert.equal(current.error,null);assert.deepEqual(current.data.appointments.map(row=>row.id),[booked.data.id]);
  assert.equal(current.data.slots.some(row=>row.id===slots[0]),false);assert.equal(current.data.slots.some(row=>row.id===slots[1]),false);
  const empty=await a.db.rpc('get_conversation_agenda',{p_optic_id:a.id,p_simulation_id:another});assert.equal(empty.error,null);assert.equal(empty.data.appointments.length,0);
  const target={p_optic_id:a.id,p_simulation_id:another,p_appointment_id:booked.data.id};
  assert.ok((await a.db.rpc('cancel_conversation_appointment',target)).error);assert.ok((await a.db.rpc('reschedule_conversation_appointment',{...target,p_slot_id:slots[2]})).error);
  const own={...target,p_simulation_id:session};
  assert.ok((await a.db.rpc('reschedule_conversation_appointment',{...own,p_slot_id:slots[3]})).error,'Conversa mantém o tipo do atendimento');
  assert.equal((await a.db.from('appointments').select('slot_id').eq('id',booked.data.id).single()).data.slot_id,slots[1]);
  const move={...own,p_slot_id:slots[2]};assert.equal((await a.db.rpc('reschedule_conversation_appointment',move)).error,null);assert.equal((await a.db.rpc('reschedule_conversation_appointment',move)).error,null);
  assert.equal((await a.db.rpc('cancel_conversation_appointment',own)).data.status,'cancelled');assert.equal((await a.db.rpc('cancel_conversation_appointment',own)).data.status,'cancelled');
  assert.ok((await a.db.rpc('book_conversation_appointment',{...args,p_slot_id:slots[2]})).error,'Retry de reserva cancelada não pode recriar uma reserva');
  assert.equal((await a.db.from('appointments').select('id')).data.length,2);
  assert.ok((await b.db.rpc('get_conversation_agenda',{p_optic_id:a.id,p_simulation_id:session})).error);
  assert.ok((await b.db.rpc('cancel_conversation_appointment',own)).error);assert.ok((await b.db.rpc('book_conversation_appointment',{...args,p_request_id:randomUUID()})).error);
  assert.ok((await client().rpc('get_conversation_agenda',{p_optic_id:a.id,p_simulation_id:session})).error);
  assert.ok((await a.db.rpc('get_conversation_agenda',{p_optic_id:a.id,p_simulation_id:null})).error);
 }finally{if(optics.length)assert.equal((await admin.from('optics').delete().in('id',optics)).error,null);for(const id of users)assert.equal((await admin.auth.admin.deleteUser(id)).error,null);}
});
