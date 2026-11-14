import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {buildApp, type InboundMessage} from '../src/app.js';
const secret = 'local-test-secret';
const fixture = (phone = 'phone-a') => JSON.stringify({object:'whatsapp_business_account', entry:[{changes:[{value:{metadata:{phone_number_id:phone},messages:[{id:'wamid.test',from:'5500000000000',type:'text',text:{body:'aceito'}}]}}]}]});
const sign = (payload: string) => 'sha256=' + createHmac('sha256',secret).update(payload).digest('hex');
const options = {appSecret:secret,verifyToken:'local-test-verify',phoneNumberIds:['phone-a']};
test('health e desafio Meta funcionam; token errado é rejeitado', async t => {
  const app = buildApp({...options, onMessage:async () => {}}); t.after(() => app.close());
  assert.equal((await app.inject({url:'/health'})).json().name,'Lumi');
  const ok = await app.inject({url:'/webhook?hub.mode=subscribe&hub.verify_token=local-test-verify&hub.challenge=123'});
  assert.equal(ok.statusCode,200); assert.equal(ok.body,'123');
  assert.equal((await app.inject({url:'/webhook?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=123'})).statusCode,403);
});
test('assinatura ausente, inválida ou corpo adulterado nunca chegam ao handler', async t => {
  let calls = 0; const app = buildApp({...options,onMessage:async () => {calls++;}}); t.after(() => app.close());
  const payload = fixture();
  for (const signature of ['', 'sha256=123', sign(payload + ' ')]) {
    assert.equal((await app.inject({method:'POST',url:'/webhook',payload,headers:{'content-type':'application/json','x-hub-signature-256':signature}})).statusCode,401);
  }
  assert.equal(calls,0);
});
test('assinatura válida entrega identidade e conteúdo ao adaptador', async t => {
  const messages: InboundMessage[] = []; const app = buildApp({...options,onMessage:async m => {messages.push(m);}}); t.after(() => app.close());
  const payload = fixture();
  const response = await app.inject({method:'POST',url:'/webhook',payload,headers:{'content-type':'application/json','x-hub-signature-256':sign(payload)}});
  assert.equal(response.statusCode,200); assert.equal(messages.length,1);
  assert.equal(messages[0].tenantId,'phone-a'); assert.equal(messages[0].text,'aceito');
});
test('número não autorizado não entrega mensagem', async t => {
  let calls = 0; const app = buildApp({...options,onMessage:async () => {calls++;}}); t.after(() => app.close());
  const payload = fixture('other-tenant');
  assert.equal((await app.inject({method:'POST',url:'/webhook',payload,headers:{'content-type':'application/json','x-hub-signature-256':sign(payload)}})).statusCode,200);
  assert.equal(calls,0);
});
test('falha no processamento devolve 503 para não perder mensagem', async t => {
  const app = buildApp({...options,onMessage:async () => {throw new Error('queue unavailable');}}); t.after(() => app.close());
  const payload = fixture();
  assert.equal((await app.inject({method:'POST',url:'/webhook',payload,headers:{'content-type':'application/json','x-hub-signature-256':sign(payload)}})).statusCode,503);
});
test('JSON assinado mas inválido é rejeitado', async t => {
  const app = buildApp({...options,onMessage:async () => {}}); t.after(() => app.close());
  for (const payload of ['{', 'null', '{}']) assert.equal((await app.inject({method:'POST',url:'/webhook',payload,headers:{'content-type':'application/json','x-hub-signature-256':sign(payload)}})).statusCode,400);
});
test('credenciais ausentes impedem inicialização', () => {
  assert.throws(() => buildApp({...options,appSecret:'',onMessage:async () => {}}), /Configure/);
});
