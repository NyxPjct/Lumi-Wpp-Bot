import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID, randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const exec = promisify(execFile);

// Intentionally run against the CLI's LOCAL stack, never a linked hosted database.
test('Supabase real: autenticação, persistência, RLS e criação atômica da ótica', async () => {
  const {stdout} = await exec(path.join(root,'node_modules/.bin/supabase'), ['status','-o','json'], {
    cwd:root,env:{...process.env,SUPABASE_HOME:path.join(root,'.local/supabase-home')},
  });
  const config = JSON.parse(stdout);
  assert.ok(['127.0.0.1','localhost'].includes(new URL(config.API_URL).hostname), 'Testes devem usar somente Supabase local');
  const opts = {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  const admin = createClient(config.API_URL,config.SERVICE_ROLE_KEY,opts);
  const client = () => createClient(config.API_URL,config.ANON_KEY,opts);
  const users = []; const optics = [];
  const password = randomBytes(24).toString('base64url');
  async function signup() {
    const db = client();
    const email = `lumi-${randomUUID()}@example.test`;
    const {data,error} = await db.auth.signUp({email,password});
    assert.equal(error,null,'Cadastro de teste deve funcionar');
    assert.ok(data.session,'O ambiente local deve autenticar sem envio de e-mail');
    users.push(data.user.id);
    return {db,email};
  }
  const payload = {p_name:'Ótica teste',p_address:'Rua Exemplo, 120',p_hours:'Das 9h às 18h',p_payments:'Pix e débito',p_delivery:'Prazo confirmado pelo atendente'};
  try {
    const a = await signup(); const b = await signup();
    const createA = await a.db.rpc('create_optic',payload);
    assert.equal(createA.error,null,'Conta A cria sua ótica'); optics.push(createA.data);
    const createB = await b.db.rpc('create_optic',{...payload,p_name:'Ótica B'});
    assert.equal(createB.error,null,'Conta B cria sua ótica'); optics.push(createB.data);
    const read = await a.db.from('optics').select('id,name');
    assert.equal(read.error,null); assert.equal(read.data.length,1); assert.equal(read.data[0].id,createA.data);
    const hidden = await a.db.from('optics').select('id').eq('id',createB.data);
    assert.equal(hidden.error,null); assert.deepEqual(hidden.data,[],'Ótica B deve ser invisível para A');
    const crossEdit = await a.db.from('optics').update({name:'Tentativa indevida'}).eq('id',createB.data).select('id');
    assert.equal(crossEdit.error,null); assert.deepEqual(crossEdit.data,[],'RLS deve impedir alteração em outra ótica');
    const readB = await b.db.from('optics').select('name').eq('id',createB.data).single();
    assert.equal(readB.data.name,'Ótica B');
    const membership = await a.db.from('optic_memberships').select('user_id');
    assert.equal(membership.data.length,1); assert.equal(membership.data[0].user_id,users[0]);
    assert.ok((await a.db.from('optic_memberships').insert({user_id:users[0],optic_id:createB.data,role:'owner'})).error,'Cliente não pode escolher vínculo de tenant');
    assert.ok((await a.db.from('optics').insert({name:'Bypass'})).error,'Criação direta proibida');
    assert.ok((await a.db.from('optics').update({id:randomUUID()}).eq('id',createA.data)).error,'Identidade da ótica não pode ser alterada');
    assert.ok((await a.db.from('optics').update({name:' '}).eq('id',createA.data)).error,'Banco deve validar dados mesmo sem UI');
    assert.ok((await a.db.rpc('create_optic',payload)).error,'A conta não pode criar uma segunda ótica');
    assert.equal((await a.db.from('optics').select('id')).data.length,1);
    const update = await a.db.from('optics').update({hours:'Das 10h às 17h'}).eq('id',createA.data).select('hours').single();
    assert.equal(update.error,null); assert.equal(update.data.hours,'Das 10h às 17h');
    await a.db.auth.signOut();
    const login = await a.db.auth.signInWithPassword({email:a.email,password});
    assert.equal(login.error,null,'Login após logout deve funcionar');
    assert.equal((await a.db.from('optics').select('hours').single()).data.hours,'Das 10h às 17h','Configuração deve sobreviver ao logout');
    assert.ok((await client().from('optics').select('id')).error,'Usuário anônimo não pode ler configurações');
    assert.ok((await client().rpc('create_optic',payload)).error,'Usuário anônimo não pode criar ótica');
    const c = await signup();
    assert.ok((await c.db.rpc('create_optic',{...payload,p_name:' '})).error,'Cadastro inválido deve reverter toda a operação');
    assert.equal((await c.db.from('optic_memberships').select('user_id')).data.length,0);
    assert.equal((await c.db.from('optics').select('id')).data.length,0);
  } finally {
    if (optics.length) {
      const {error} = await admin.from('optics').delete().in('id',optics);
      assert.equal(error,null,'Limpeza das óticas criadas por este teste');
    }
    for (const id of users) assert.equal((await admin.auth.admin.deleteUser(id)).error,null,'Limpeza das contas criadas por este teste');
  }
});
