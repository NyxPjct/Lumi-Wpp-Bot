import type {SupabaseClient} from '@supabase/supabase-js';
import type {AgendaCommand,ConversationAgenda} from '@lumi/shared';
import {readAgenda} from './agenda';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Per-tab simulation grouping, scoped by authenticated user + optic. This is not
// customer authentication; real WhatsApp callers require verified server identity.
export function simulationSession(userId:string,opticId:string):string {
  const key=`lumi:simulation:${userId}:${opticId}`;
  const existing=sessionStorage.getItem(key);
  if(existing){if(!uuid.test(existing))throw new Error('Sessão de agendamento inválida.');return existing;}
  const id=crypto.randomUUID();sessionStorage.setItem(key,id);return id;
}
export async function fetchConversationAgenda(db:SupabaseClient,opticId:string,simulationId:string):Promise<ConversationAgenda>{
  const {data,error}=await db.rpc('get_conversation_agenda',{p_optic_id:opticId,p_simulation_id:simulationId}).abortSignal(AbortSignal.timeout(15000));
  if(error)throw new Error('Não foi possível consultar os agendamentos de teste.');
  const agenda=readAgenda(data);
  return {kind:'ready',slots:agenda.slots.filter(slot=>!slot.is_cancelled&&!slot.is_booked),appointments:agenda.appointments};
}
export async function executeAgendaCommand(db:SupabaseClient,opticId:string,simulationId:string,command:AgendaCommand,requestId:string):Promise<string>{
  const common={p_optic_id:opticId,p_simulation_id:simulationId};
  const result=command.type==='book'
    ?await db.rpc('book_conversation_appointment',{...common,p_slot_id:command.slot.id,p_customer_name:command.name,p_request_id:requestId}).abortSignal(AbortSignal.timeout(15000))
    :command.type==='cancel'
    ?await db.rpc('cancel_conversation_appointment',{...common,p_appointment_id:command.booking.id}).abortSignal(AbortSignal.timeout(15000))
    :await db.rpc('reschedule_conversation_appointment',{...common,p_appointment_id:command.booking.id,p_slot_id:command.slot.id}).abortSignal(AbortSignal.timeout(15000));
  if(result.error)throw new Error('Não foi possível confirmar a operação da agenda.');
  const row=result.data;
  if(!row||!uuid.test(row.id)||row.optic_id!==opticId||row.simulation_id!==simulationId
    ||row.status!==(command.type==='cancel'?'cancelled':'confirmed')
    ||(command.type!=='book'&&row.id!==command.booking.id)
    ||(command.type!=='cancel'&&row.slot_id!==command.slot.id))throw new Error('Resposta de confirmação inválida.');
  return row.id;
}
