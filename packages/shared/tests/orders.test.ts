import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOrderCode,orderStatusReply,transition,initialConversation,type Conversation} from '../src/index.js';
const step=(state:Conversation,input:string,kind:'available'|'demo'|'unavailable'='available')=>transition(state,input,undefined,null,undefined,undefined,{kind});
const accepted=()=>step(initialConversation(),'aceito').conversation;
test('código de pedido é normalizado e rejeita formatos ambíguos ou comandos reservados',()=>{
 assert.equal(normalizeOrderCode(' lum-001 '),'LUM-001');assert.equal(normalizeOrderCode('AB123'),'AB123');
 for(const code of ['a','--','A--B','LUM-','PED_1','ábc','MENU','VOLTAR','HUMANO','PED-PESSOA','ATENDENTE-1','x'.repeat(31),"' OR 1=1"] )assert.equal(normalizeOrderCode(code),null,code);
});
test('consulta exige consentimento, código válido e não anuncia status antes da resposta',()=>{
 assert.equal(step(initialConversation(),'4').conversation.state,'privacidade');
 const prompt=step(accepted(),'4');assert.equal(prompt.conversation.state,'order_code');assert.equal(prompt.orderLookup,undefined);
 const result=step(prompt.conversation,' lum-001 ');assert.equal(result.conversation.state,'order_pending');assert.deepEqual(result.orderLookup,{code:'LUM-001'});assert.deepEqual(result.replies,[]);
 assert.equal(step(result.conversation,'LUM-002').orderLookup,undefined);
});
test('repetição consulta o mesmo código; saída, novo código e transbordo não disparam consulta',()=>{
 const pending=step(step(accepted(),'4').conversation,'LUM-001').conversation;
 const failed:Conversation={...pending,state:'order_retry'};
 assert.deepEqual(step(failed,'1').orderLookup,{code:'LUM-001'});
 assert.equal(step(failed,'2').conversation.state,'order_code');assert.equal(step(failed,'2').orderLookup,undefined);
 assert.equal(step(failed,'0').conversation.state,'menu');assert.equal(step(failed,'menu').conversation.orderCode,undefined);
 assert.equal(step(failed,'atendente').conversation.state,'humano');
 let state=step(accepted(),'4').conversation;for(const text of ['x','--','??'])state=step(state,text).conversation;assert.equal(state.state,'humano');
});
test('resposta de status é mínima; pedido ausente e modo sem banco não recebem status fictício',()=>{
 for(const status of ['in_production','ready','collected'] as const){const reply=orderStatusReply('LUM-001',{code:'LUM-001',status});assert.match(reply,/LUM-001/);assert.doesNotMatch(reply,/telefone|receita|enviado/);}
 assert.match(orderStatusReply('LUM-404',null),/Não encontrei/);
 for(const kind of ['demo','unavailable'] as const){const result=step(accepted(),'4',kind);assert.equal(result.conversation.state,'menu');assert.equal(result.orderLookup,undefined);assert.doesNotMatch(result.replies[0],/pronto para retirar|em produção/);}
});
