'use client';
import {Clover} from '../../components/clover';
import Link from 'next/link';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {serviceTypes,serviceLabels,slotDurations,formatSlotTime,parseBrasiliaTime,validTestName,type ServiceType} from '@lumi/shared';
import {useDemoSettings} from '../../components/demo-settings';
import {getSupabase} from '../../lib/supabase';
import {readAgenda,type AgendaData} from '../../lib/agenda';

export default function AgendaPage(){
  const {user,mode,ready,opticId}=useDemoSettings();
  const scope=`${user?.id??''}:${opticId??''}`;
  const currentScope=useRef(scope);currentScope.current=scope;
  const [loaded,setLoaded]=useState({scope:'',data:{slots:[],appointments:[]} as AgendaData,error:''});
  const [revision,setRevision]=useState(0);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [start,setStart]=useState('');
  const [duration,setDuration]=useState(30);
  const [service,setService]=useState<ServiceType>('exam');
  const [slotId,setSlotId]=useState('');
  const [name,setName]=useState('');
  const [targets,setTargets]=useState<Record<string,string>>({});
  const [confirmation,setConfirmation]=useState<{kind:'slot'|'booking';id:string}|null>(null);
  const request=useRef<{key:string;id:string}|null>(null);
  useEffect(()=>{
    if(!ready)return;
    let active=true;setLoading(true);
    async function load(){
      try{
        let data:AgendaData={slots:[],appointments:[]};
        if(mode==='supabase'&&user&&opticId){
          const db=getSupabase();if(!db)throw new Error('Supabase indisponível.');
          const result=await db.rpc('get_agenda',{p_optic_id:opticId});
          if(result.error)throw new Error('Não foi possível carregar a agenda. Verifique sua conexão e tente novamente.');
          data=readAgenda(result.data);
        }
        if(active)setLoaded({scope,data,error:''});
      }catch(error){if(active)setLoaded({scope,data:{slots:[],appointments:[]},error:error instanceof Error?error.message:'Não foi possível carregar a agenda.'});}
      finally{if(active)setLoading(false);}
    }
    void load();return()=>{active=false;};
  },[ready,mode,user?.id,opticId,scope,revision]);
  useEffect(()=>{setBusy(false);setStart('');setMessage('');setError('');setName('');setSlotId('');setTargets({});setConfirmation(null);request.current=null;},[scope]);

  async function mutate(rpc:string,args:Record<string,unknown>,success:string):Promise<boolean>{
    if(busy||!ready||loading||loaded.scope!==scope||loaded.error||!user||!opticId)return false;
    const requestedScope=scope;setBusy(true);setError('');setMessage('');
    try{
      const db=getSupabase();if(!db)throw new Error('Supabase indisponível.');
      const result=await db.rpc(rpc,{p_optic_id:opticId,...args});
      if(result.error)throw new Error(rpc==='create_appointment_slot'
        ?'Não foi possível criar o horário. Verifique se está no futuro, dentro de um ano e sem sobreposição. Somente o proprietário cria horários.'
        :rpc==='cancel_appointment_slot'
        ?'Não foi possível retirar o horário. Cancele uma reserva ativa antes; somente o proprietário retira horários.'
        :'Não foi possível concluir. O horário pode estar ocupado ou indisponível. Recarregue a agenda antes de tentar novamente.');
      if(rpc==='book_appointment'&&result.data?.status!=='confirmed')throw new Error('Essa solicitação já foi cancelada. Recarregue a agenda e faça uma nova reserva.');
      if(requestedScope!==currentScope.current)return false;
      setMessage(success);setConfirmation(null);setRevision(value=>value+1);return true;
    }catch(error){if(requestedScope===currentScope.current)setError(error instanceof Error?error.message:'Não foi possível concluir.');return false;}
    finally{if(requestedScope===currentScope.current)setBusy(false);}
  }
  async function createSlot(event:FormEvent){
    event.preventDefault();const instant=parseBrasiliaTime(start);
    if(!instant){setError('Informe uma data e hora válidas no horário de Brasília.');return;}
    if(await mutate('create_appointment_slot',{p_starts_at:instant,p_duration_minutes:duration,p_service:service},'Horário de teste criado.'))setStart('');
  }
  async function book(event:FormEvent){
    event.preventDefault();
    if(!validTestName(name)||!slotId){setError('Escolha um horário livre e informe um nome fictício com 2 a 80 caracteres.');return;}
    const key=`${scope}:${slotId}:${name.trim()}`;
    if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
    if(await mutate('book_appointment',{p_slot_id:slotId,p_customer_name:name.trim(),p_request_id:request.current.id},'Agendamento de teste confirmado.')){setName('');setSlotId('');request.current=null;}
  }
  if(!ready)return <p className="notice" role="status">Carregando conta…</p>;
  if(mode==='demo')return <section className="completion"><p className="eyebrow">AGENDA DA ÓTICA</p><h1>A agenda usa o Supabase local.</h1><p>Inicie o modo Supabase e entre em uma conta para criar e reservar horários. A demonstração sem banco não registra agendamentos.</p><Link className="primaryButton" href="/conta">Ver minha conta →</Link></section>;
  if(!user)return <section className="completion"><h1>Entre para acessar a agenda.</h1><Link className="primaryButton" href="/conta">Entrar ou criar conta →</Link></section>;
  if(!opticId)return <section className="completion"><h1>Configure sua ótica primeiro.</h1><Link className="primaryButton" href="/configuracao">Configurar minha ótica →</Link></section>;
  const data=loaded.scope===scope?loaded.data:{slots:[],appointments:[]};
  const available=data.slots.filter(slot=>!slot.is_cancelled&&!slot.is_booked);
  const disabled=busy||loading||loaded.scope!==scope||Boolean(loaded.error);
  const optionLabel=(slot:AgendaData['slots'][number])=>`${formatSlotTime(slot.starts_at)} · ${serviceLabels[slot.service]} · ${slot.duration_minutes} min`;
  return <>
    <section className="heading"><div><p className="eyebrow">CADA ENCONTRO, UM CUIDADO</p><h1>Um horário certo<br/>para cada atendimento.</h1><p>Organize exames, ajustes e retiradas em uma agenda por ótica.</p></div><div className="brandMark" aria-hidden="true"><Clover/></div></section>
    <p className="notice">Agenda de teste · Todos os horários são de Brasília. Use somente nomes fictícios. Não há lembretes, envio de mensagens ou agendamento pelo WhatsApp nesta etapa.</p>
    {message&&<p className="notice" role="status">{message}</p>}
    {(error||loaded.error)&&<p className="formMessage" role="alert">{error||loaded.error}<button className="textButton" onClick={()=>{setError('');setRevision(value=>value+1);}}>Recarregar agenda</button></p>}
    <div className="agendaForms">
      <section className="configCard"><form className="onboardingForm" onSubmit={createSlot}><h2>Abrir um horário</h2><p className="formIntro">O proprietário pode criar horários sem sobreposição, para os próximos 365 dias.</p><fieldset disabled={disabled}>
        <div className="field"><label htmlFor="slot-start">Data e hora · Brasília</label><input id="slot-start" type="datetime-local" required value={start} onChange={event=>setStart(event.target.value)}/></div>
        <div className="field"><label htmlFor="slot-service">Tipo de atendimento</label><select id="slot-service" value={service} onChange={event=>setService(event.target.value as ServiceType)}>{serviceTypes.map(type=><option key={type} value={type}>{serviceLabels[type]}</option>)}</select></div>
        <div className="field"><label htmlFor="slot-duration">Duração</label><select id="slot-duration" value={duration} onChange={event=>setDuration(Number(event.target.value))}>{slotDurations.map(minutes=><option key={minutes} value={minutes}>{minutes} minutos</option>)}</select></div>
        <button className="primaryButton" disabled={disabled}>Criar horário</button>
      </fieldset></form></section>
      <section className="configCard"><form className="onboardingForm" onSubmit={book}><h2>Reservar um atendimento</h2><p className="formIntro">A reserva só é confirmada depois de salvar no banco.</p><fieldset disabled={disabled}>
        <div className="field"><label htmlFor="booking-slot">Horário livre</label><select id="booking-slot" required value={slotId} onChange={event=>{setSlotId(event.target.value);request.current=null;}}><option value="">Selecione um horário</option>{available.map(slot=><option value={slot.id} key={slot.id}>{optionLabel(slot)}</option>)}</select></div>
        <div className="field"><label htmlFor="booking-name">Nome fictício para teste</label><input id="booking-name" minLength={2} maxLength={80} required value={name} onChange={event=>{setName(event.target.value);request.current=null;}} placeholder="Ex.: Cliente de teste"/></div>
        {!loading&&!available.length&&<p className="note">Nenhum horário livre. Crie um horário ou cancele uma reserva para liberar uma vaga.</p>}
        <button className="primaryButton" disabled={disabled||!available.length}>Confirmar agendamento de teste</button>
      </fieldset></form></section>
    </div>
    <div className="agendaSectionTitle"><h2>Próximos horários</h2><button className="secondaryButton" disabled={busy||loading} onClick={()=>setRevision(value=>value+1)}>Atualizar agenda</button></div>
    <p className="note">Até 100 horários futuros, incluindo vagas reservadas e retiradas da agenda.</p>
    {loading?<p className="notice" role="status">Carregando agenda…</p>:!data.slots.length?<section className="emptyState"><h2>A agenda está aberta para começar.</h2><p>Crie o primeiro horário de teste no formulário acima.</p></section>:<div className="agendaSlots">{data.slots.map(slot=><article className="agendaSlot" key={slot.id} data-slot-id={slot.id}>
      <div><span className="badge">{slot.is_cancelled?'Retirado':slot.is_booked?'Reservado':'Livre'}</span><h3>{formatSlotTime(slot.starts_at)}</h3><p>{serviceLabels[slot.service]} · {slot.duration_minutes} min · Brasília</p></div>
      {!slot.is_cancelled&&!slot.is_booked&&(confirmation?.kind==='slot'&&confirmation.id===slot.id?<div className="cancelConfirmation"><p>Retirar este horário da agenda?</p><button className="dangerButton" disabled={disabled} onClick={()=>void mutate('cancel_appointment_slot',{p_slot_id:slot.id},'Horário retirado da agenda.')}>Confirmar retirada</button><button className="textButton" onClick={()=>setConfirmation(null)}>Manter horário</button></div>:<button className="textButton" disabled={disabled} onClick={()=>setConfirmation({kind:'slot',id:slot.id})}>Retirar horário</button>)}
    </article>)}</div>}
    <div className="agendaSectionTitle"><h2>Agendamentos de teste</h2></div><p className="note">Últimos 100 registros. Cancelar libera o horário; remarcar altera a reserva somente se a nova vaga estiver livre.</p>
    {!loading&&!data.appointments.length?<section className="emptyState"><h2>Nenhum agendamento ainda.</h2><p>Reserve um horário com um nome fictício para testar o fluxo.</p></section>:<div className="quoteList">{data.appointments.map(appointment=><article className="quoteCard appointmentCard" key={appointment.id} data-appointment-id={appointment.id}>
      <span className="badge">{appointment.status==='confirmed'?'Confirmado':'Cancelado'} · Teste</span><h2>{appointment.customer_name}</h2><strong>{formatSlotTime(appointment.slot.starts_at)}</strong><p>{serviceLabels[appointment.slot.service]} · {appointment.slot.duration_minutes} min · Brasília</p>
      {appointment.status==='confirmed'&&<>
        <div className="field"><label htmlFor={`reschedule-${appointment.id}`}>Novo horário</label><select id={`reschedule-${appointment.id}`} disabled={disabled} value={targets[appointment.id]??''} onChange={event=>setTargets(current=>({...current,[appointment.id]:event.target.value}))}><option value="">Escolha uma vaga para remarcar</option>{available.map(slot=><option key={slot.id} value={slot.id}>{optionLabel(slot)}</option>)}</select></div>
        <button className="secondaryButton" disabled={disabled||!available.some(slot=>slot.id===targets[appointment.id])} onClick={async()=>{if(await mutate('reschedule_appointment',{p_appointment_id:appointment.id,p_slot_id:targets[appointment.id]},'Agendamento remarcado; o horário anterior foi liberado.'))setTargets(current=>({...current,[appointment.id]:''}));}}>Remarcar</button>
        {confirmation?.kind==='booking'&&confirmation.id===appointment.id?<div className="cancelConfirmation"><p>Cancelar este agendamento de teste?</p><button className="dangerButton" disabled={disabled} onClick={()=>void mutate('cancel_appointment',{p_appointment_id:appointment.id},'Agendamento cancelado; o horário foi liberado.')}>Confirmar cancelamento</button><button className="textButton" onClick={()=>setConfirmation(null)}>Manter agendamento</button></div>:<button className="textButton" disabled={disabled} onClick={()=>setConfirmation({kind:'booking',id:appointment.id})}>Cancelar agendamento</button>}
      </>}
      <p className="quoteReference">Referência: {appointment.id}</p>
    </article>)}</div>}
  </>;
}
