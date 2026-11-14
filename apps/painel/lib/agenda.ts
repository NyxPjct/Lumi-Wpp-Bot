import {serviceTypes,slotDurations,type ServiceType} from '@lumi/shared';
export interface AgendaSlot {
  id:string;
  optic_id:string;
  starts_at:string;
  duration_minutes:number;
  service:ServiceType;
  is_cancelled:boolean;
  is_booked:boolean;
}
export interface Appointment {
  id:string;
  optic_id:string;
  slot_id:string;
  customer_name:string;
  status:'confirmed'|'cancelled';
  slot:AgendaSlot;
}
export interface AgendaData {slots:AgendaSlot[];appointments:Appointment[]}
function readSlot(input:unknown):AgendaSlot {
  const row=input as AgendaSlot|null;
  if(!row||typeof row.id!=='string'||typeof row.optic_id!=='string'||typeof row.starts_at!=='string'||!Number.isFinite(Date.parse(row.starts_at))
    ||!slotDurations.some(value=>value===row.duration_minutes)||!serviceTypes.includes(row.service)||typeof row.is_cancelled!=='boolean')throw new Error('Horário inválido retornado pelo banco.');
  return {...row,is_booked:row.is_booked===true};
}
export function readAgenda(input:unknown):AgendaData {
  const data=input as {slots?:unknown[];appointments?:unknown[]}|null;
  if(!data||!Array.isArray(data.slots)||!Array.isArray(data.appointments))throw new Error('Agenda inválida retornada pelo banco.');
  return {slots:data.slots.map(readSlot),appointments:data.appointments.map(input=>{
    const row=input as Appointment|null;
    if(!row||typeof row.id!=='string'||typeof row.optic_id!=='string'||typeof row.slot_id!=='string'||typeof row.customer_name!=='string'||!['confirmed','cancelled'].includes(row.status))throw new Error('Agendamento inválido retornado pelo banco.');
    const slot=readSlot(row.slot);
    if(slot.id!==row.slot_id||slot.optic_id!==row.optic_id)throw new Error('Vínculo de agendamento inválido.');
    return {...row,slot};
  })};
}
