import {serviceTypes,serviceLabels,formatSlotTime,validTestName,type ServiceType} from './agenda';
export interface ConversationSlot {id:string;starts_at:string;duration_minutes:number;service:ServiceType}
export interface ConversationBooking {id:string;customer_name:string;status:'confirmed'|'cancelled';slot:ConversationSlot}
export type ConversationAgenda = {kind:'ready';slots:ConversationSlot[];appointments:ConversationBooking[]}|{kind:'unavailable'|'demo'};
export type AgendaCommand =
  | {type:'book';slot:ConversationSlot;name:string}
  | {type:'cancel';booking:ConversationBooking}
  | {type:'reschedule';booking:ConversationBooking;slot:ConversationSlot};
export type AgendaFlow =
  | {phase:'home'}
  | {phase:'unavailable';demo:boolean}
  | {phase:'service'}
  | {phase:'slots';options:ConversationSlot[];page:number;booking?:ConversationBooking}
  | {phase:'name';slot:ConversationSlot}
  | {phase:'bookings';options:ConversationBooking[];page:number;action:'cancel'|'reschedule'}
  | {phase:'confirm';command:AgendaCommand}
  | {phase:'pending'|'retry';command:AgendaCommand};
interface Result {flow:AgendaFlow;replies:string[];valid:boolean;command?:AgendaCommand;exit?:boolean}
const home='O que deseja fazer na agenda de teste?\n1. Novo agendamento\n2. Remarcar agendamento\n3. Cancelar agendamento\n0. Voltar ao menu principal';
const pageSize=5;
export const slotLabel=(slot:ConversationSlot)=>`${formatSlotTime(slot.starts_at)} · ${serviceLabels[slot.service]} · ${slot.duration_minutes} min · Brasília`;
const bookingLabel=(booking:ConversationBooking)=>`${slotLabel(booking.slot)} · ${booking.customer_name}`;
function listText(options:string[],page:number):string {
  const subset=options.slice(page*pageSize,(page+1)*pageSize);
  return subset.map((label,index)=>`${index+1}. ${label}`).join('\n')
    +(options.length>(page+1)*pageSize?'\n8. Próximas opções':'')+(page>0?'\n9. Opções anteriores':'')+'\n0. Voltar à agenda';
}
function slotsResult(options:ConversationSlot[],booking?:ConversationBooking):Result {
  if(!options.length)return {flow:{phase:'home'},valid:true,replies:['Não há vagas livres para esse atendimento entre os próximos 100 horários consultados. Você pode tentar mais tarde ou pedir um atendente.',home]};
  const flow:AgendaFlow={phase:'slots',options,page:0,...booking?{booking}:{}};
  return {flow,valid:true,replies:['Escolha um horário. A vaga será validada novamente ao confirmar.\n'+listText(options.map(slotLabel),0)]};
}
function prompt(command:AgendaCommand):string {
  if(command.type==='book')return `Confirma este agendamento de teste?\n${slotLabel(command.slot)}\nNome fictício: ${command.name}\nResponda sim ou não. A reserva só acontece após a confirmação do banco.`;
  if(command.type==='cancel')return `Confirma cancelar este agendamento de teste?\n${bookingLabel(command.booking)}\nResponda sim ou não.`;
  return `Confirma remarcar o agendamento de teste?\nDe: ${slotLabel(command.booking.slot)}\nPara: ${slotLabel(command.slot)}\nResponda sim ou não. A reserva anterior permanece válida se a troca falhar.`;
}
export function startAgenda(context?:ConversationAgenda):Result {
  if(context?.kind!=='ready')return {flow:{phase:'unavailable',demo:context?.kind==='demo'},valid:true,replies:[context?.kind==='demo'
    ?'O agendamento exige uma conta e o Supabase local. Este modo de demonstração não cria reservas. Digite menu para voltar.'
    :'Não foi possível consultar a agenda. Verifique a conexão com o Supabase e a configuração da ótica. Digite menu para voltar ou tente novamente.']};
  return {flow:{phase:'home'},valid:true,replies:[home]};
}
export function transitionAgenda(flow:AgendaFlow,input:string,context:ConversationAgenda|undefined,now:string):Result {
  const text=input.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const invalid=():Result=>({flow,valid:false,replies:['Não entendi. Escolha uma opção da lista. Digite menu para voltar ou atendente para pedir ajuda.']});
  if(flow.phase==='pending')return {flow,valid:true,replies:['Aguarde a confirmação da operação.']};
  if(text==='0')return flow.phase==='home'||flow.phase==='unavailable'?{flow:{phase:'home'},valid:true,replies:[],exit:true}:startAgenda(context);
  if(flow.phase==='retry'){
    if(text==='1')return {flow:{phase:'pending',command:flow.command},command:flow.command,valid:true,replies:[]};
    if(text==='2')return startAgenda(context);
    return invalid();
  }
  if(flow.phase==='unavailable')return text==='1'?startAgenda(context):invalid();
  if(context?.kind!=='ready')return startAgenda(context);
  const future=(slot:ConversationSlot)=>Date.parse(slot.starts_at)>Date.parse(now);
  const free=(service:ServiceType)=>context.slots.filter(slot=>slot.service===service&&future(slot)).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
  if(flow.phase==='home'){
    if(text==='1')return {flow:{phase:'service'},valid:true,replies:['Qual atendimento de teste deseja agendar?\n'+serviceTypes.map((type,index)=>`${index+1}. ${serviceLabels[type]}`).join('\n')+'\n0. Voltar à agenda']};
    if(text==='2'||text==='3'){
      const options=context.appointments.filter(booking=>booking.status==='confirmed'&&future(booking.slot));
      if(!options.length)return {flow,valid:true,replies:['Não há agendamentos de teste futuros e confirmados entre os últimos 50 consultados nesta sessão da aba. Reservas criadas no painel ou em outra sessão não aparecem aqui.',home]};
      return {flow:{phase:'bookings',options,page:0,action:text==='2'?'reschedule':'cancel'},valid:true,replies:['Escolha o agendamento de teste:\n'+listText(options.map(bookingLabel),0)]};
    }
  }else if(flow.phase==='service'){
    if(/^[1-3]$/.test(text))return slotsResult(free(serviceTypes[Number(text)-1]));
  }else if(flow.phase==='slots'||flow.phase==='bookings'){
    const options=flow.options;
    const labels=flow.phase==='slots'?flow.options.map(slotLabel):flow.options.map(bookingLabel);
    if(text==='8'&&options.length>(flow.page+1)*pageSize)return {flow:{...flow,page:flow.page+1},valid:true,replies:[listText(labels,flow.page+1)]};
    if(text==='9'&&flow.page>0)return {flow:{...flow,page:flow.page-1},valid:true,replies:[listText(labels,flow.page-1)]};
    if(/^[1-5]$/.test(text)){
      const index=flow.page*pageSize+Number(text)-1;
      if(flow.phase==='slots'){
        const slot=flow.options[index];if(!slot)return invalid();
        if(!future(slot))return {flow:{phase:'home'},valid:true,replies:['Esse horário já passou. Consulte a agenda novamente.',home]};
        if(flow.booking){const command:AgendaCommand={type:'reschedule',booking:flow.booking,slot};return {flow:{phase:'confirm',command},valid:true,replies:[prompt(command)]};}
        return {flow:{phase:'name',slot},valid:true,replies:['Informe um nome fictício de 2 a 80 caracteres para este teste. Não envie telefone, receita ou dados de saúde.\n0. Voltar à agenda']};
      }
      const booking=flow.options[index];if(!booking)return invalid();
      if(flow.action==='cancel'){const command:AgendaCommand={type:'cancel',booking};return {flow:{phase:'confirm',command},valid:true,replies:[prompt(command)]};}
      return slotsResult(free(booking.slot.service),booking);
    }
  }else if(flow.phase==='name'){
    if(validTestName(input)){const command:AgendaCommand={type:'book',slot:flow.slot,name:input.trim()};return {flow:{phase:'confirm',command},valid:true,replies:[prompt(command)]};}
  }else if(flow.phase==='confirm'){
    if(['sim','confirmar'].includes(text))return {flow:{phase:'pending',command:flow.command},command:flow.command,valid:true,replies:[]};
    if(['nao','não'].includes(text))return {flow:{phase:'home'},valid:true,replies:['Tudo bem. Nenhuma alteração foi solicitada.',home]};
  }
  return invalid();
}
export function agendaSucceeded(command:AgendaCommand,reference:string):Result {
  const message=command.type==='book'?`Agendamento de teste confirmado pelo banco.\n${slotLabel(command.slot)}`
    :command.type==='cancel'?'Cancelamento de teste confirmado pelo banco. O horário foi liberado, se ainda estiver no futuro.'
    :`Remarcação de teste confirmada pelo banco.\n${slotLabel(command.slot)}\nO horário anterior foi liberado.`;
  return {flow:{phase:'home'},valid:true,replies:[message+`\nReferência: ${reference}`,home]};
}
export function agendaUncertain(command:AgendaCommand):Result {
  return {flow:{phase:'retry',command},valid:true,replies:['Não consegui confirmar o resultado da operação. A vaga pode ter mudado ou a conexão falhado. Nenhum horário alternativo foi escolhido automaticamente.\n1. Tentar novamente a mesma solicitação\n2. Consultar a agenda de novo\n0. Voltar à agenda']};
}
export function agendaQuickReplies(flow:AgendaFlow):{input:string;label:string}[]{
  if(flow.phase==='unavailable')return [...flow.demo?[]:[{input:'1',label:'Tentar consultar agenda'}],{input:'0',label:'Menu principal'}];
  if(flow.phase==='home')return [{input:'1',label:'Novo agendamento'},{input:'2',label:'Remarcar agendamento'},{input:'3',label:'Cancelar agendamento'},{input:'0',label:'Menu principal'}];
  if(flow.phase==='service')return serviceTypes.map((type,index)=>({input:String(index+1),label:serviceLabels[type]}));
  if(flow.phase==='confirm')return [{input:'sim',label:'Sim, confirmar'},{input:'não',label:'Não, voltar'}];
  if(flow.phase==='retry')return [{input:'1',label:'Tentar novamente'},{input:'2',label:'Consultar agenda novamente'},{input:'0',label:'Voltar à agenda'}];
  if(flow.phase==='slots'||flow.phase==='bookings'){
    const result=flow.options.slice(flow.page*pageSize,(flow.page+1)*pageSize).map((option,index)=>({input:String(index+1),label:`Opção ${index+1}: ${'customer_name'in option?bookingLabel(option):slotLabel(option)}`}));
    if(flow.options.length>(flow.page+1)*pageSize)result.push({input:'8',label:'Próximas opções'});
    if(flow.page>0)result.push({input:'9',label:'Opções anteriores'});
    return result;
  }
  return [];
}
