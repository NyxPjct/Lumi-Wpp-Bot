import {test} from 'node:test';
import assert from 'node:assert/strict';
import {transition,initialConversation,agendaSucceeded,agendaUncertain,type Conversation,type ConversationAgenda,type ConversationSlot} from '../src/index.js';
const now='2026-11-14T12:00:00.000Z';
const slots:ConversationSlot[]=Array.from({length:7},(_,index)=>({id:`slot-${index}`,starts_at:`2026-11-${String(16+index).padStart(2,'0')}T13:00:00.000Z`,duration_minutes:30,service:'exam'}));
const context:ConversationAgenda={kind:'ready',slots,appointments:[]};
const step=(state:Conversation,input:string,data:ConversationAgenda=context)=>transition(state,input,now,null,undefined,data);
function start(){return step(step(initialConversation(),'aceito').conversation,'3').conversation;}
function confirmation(){let state=start();for(const input of ['1','1','1','Cliente Fictício'])state=step(state,input).conversation;return state;}
test('agenda exige consentimento e só emite comando após confirmação explícita',()=>{
 assert.equal(step(initialConversation(),'3').conversation.state,'privacidade');
 const ready=confirmation();assert.equal(ready.agenda?.phase,'confirm');
 assert.equal(step(ready,'não').agendaCommand,undefined);
 const result=step(ready,'sim');assert.equal(result.agendaCommand?.type,'book');
 assert.ok(result.agendaCommand?.type==='book');assert.equal(result.agendaCommand.name,'Cliente Fictício');assert.equal(result.agendaCommand.slot.id,'slot-0');
 assert.equal(result.conversation.agenda?.phase,'pending');assert.deepEqual(result.replies,[],'Não pode anunciar sucesso antes do banco');
 assert.match(agendaSucceeded(result.agendaCommand,'ref-teste').replies[0],/confirmado pelo banco/);
});
test('paginação mantém a escolha apontando para a opção originalmente mostrada',()=>{
 let state=start();for(const input of ['1','1','8'])state=step(state,input).conversation;
 assert.equal(state.agenda?.phase,'slots');
 const changed:ConversationAgenda={kind:'ready',slots:slots.slice(6),appointments:[]};
 const chosen=step(state,'1',changed).conversation;
 assert.ok(chosen.agenda?.phase==='name');assert.equal(chosen.agenda.slot.id,'slot-5');
 const previous=step(state,'9').conversation;assert.ok(previous.agenda?.phase==='slots');assert.equal(previous.agenda.page,0);
});
test('falha conserva o mesmo comando para repetir sem criar outra solicitação',()=>{
 const confirmed=step(confirmation(),'sim');assert.ok(confirmed.agendaCommand);
 const uncertain=agendaUncertain(confirmed.agendaCommand);
 const retry=step({...confirmed.conversation,agenda:uncertain.flow},'1',{kind:'unavailable'});
 assert.equal(retry.agendaCommand,confirmed.agendaCommand);
 assert.equal(step(retry.conversation,'sim').agendaCommand,undefined,'Estado pendente não executa novamente');
});
test('não há vagas ou serviço indisponível: não inventa horário nem confirma reserva',()=>{
 const empty:ConversationAgenda={kind:'ready',slots:[],appointments:[]};
 const service=step(step(start(),'1',empty).conversation,'1',empty);
 assert.equal(service.conversation.agenda?.phase,'home');assert.match(service.replies.join(' '),/Não há vagas livres/);assert.equal(service.agendaCommand,undefined);
 for(const unavailable of [{kind:'demo'},{kind:'unavailable'}] as const){const result=step(step(initialConversation(),'aceito').conversation,'3',unavailable);assert.equal(result.agendaCommand,undefined);assert.match(result.replies[0],/não cria reservas|Não foi possível consultar/);}
});
test('cancelar e remarcar selecionam só reservas confirmadas futuras do contexto',()=>{
 const booking={id:'booking-own',customer_name:'Cliente de teste',status:'confirmed' as const,slot:slots[0]};
 const data:ConversationAgenda={kind:'ready',slots:[slots[1],{...slots[2],service:'adjustment'}],appointments:[booking,{...booking,id:'cancelled',status:'cancelled'},{...booking,id:'past',slot:{...slots[0],starts_at:'2020-01-01T13:00:00Z'}}]};
 const selected=step(start(),'3',data);assert.ok(selected.conversation.agenda?.phase==='bookings');assert.equal(selected.conversation.agenda.options.length,1);
 const cancel=step(step(selected.conversation,'1',data).conversation,'sim',data);assert.ok(cancel.agendaCommand?.type==='cancel');assert.equal(cancel.agendaCommand.booking.id,'booking-own');
 const reschedule=step(step(start(),'2',data).conversation,'1',data);assert.ok(reschedule.conversation.agenda?.phase==='slots');assert.equal(reschedule.conversation.agenda.options.length,1);assert.equal(reschedule.conversation.agenda.options[0].service,'exam');
 const move=step(step(reschedule.conversation,'1',data).conversation,'sim',data);assert.equal(move.agendaCommand?.type,'reschedule');
});
test('recusa, saída, palavra de transbordo e três respostas inválidas não mutam a agenda',()=>{
 const refused=step(confirmation(),'não');assert.equal(refused.agendaCommand,undefined);assert.equal(refused.conversation.agenda?.phase,'home');
 assert.equal(step(start(),'0').conversation.state,'menu');
 assert.equal(step(confirmation(),'menu').conversation.agenda,undefined);
 assert.equal(step(confirmation(),'quero atendente').conversation.state,'humano');
 let state=start();for(const input of ['x','y','z'])state=step(state,input).conversation;assert.equal(state.state,'humano');
});
