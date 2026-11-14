export const serviceTypes=['exam','adjustment','pickup'] as const;
export type ServiceType=typeof serviceTypes[number];
export const serviceLabels:Record<ServiceType,string>={exam:'Exame',adjustment:'Ajuste',pickup:'Retirada'};
export const slotDurations=[15,30,60] as const;
export const formatSlotTime=(instant:string)=>new Intl.DateTimeFormat('pt-BR',{
  timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short',
}).format(new Date(instant));

// Current Brasília civil time is UTC-03:00. Round-trip in the named zone to reject
// invalid calendar dates and avoid interpreting datetime-local in the browser zone.
export function parseBrasiliaTime(input:string):string|null {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input))return null;
  const date=new Date(`${input}:00-03:00`);
  if(!Number.isFinite(date.getTime()))return null;
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',
  }).formatToParts(date);
  const value=(part:string)=>parts.find(item=>item.type===part)?.value;
  const normalized=`${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
  return normalized===input?date.toISOString():null;
}
export function validTestName(input:string):boolean {
  return input.trim().length>=2&&input.trim().length<=80;
}
