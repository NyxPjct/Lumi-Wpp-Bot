'use client';
import {Clover} from '../../components/clover';
import Link from 'next/link';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {normalizeOrderCode,validTestName,orderStatuses,orderStatusLabels,type OrderStatus} from '@lumi/shared';
import {useDemoSettings} from '../../components/demo-settings';
import {getSupabase} from '../../lib/supabase';
import {readOrder,type StoredOrder} from '../../lib/orders';

export default function OrdersPage(){
  const {user,mode,ready,opticId}=useDemoSettings();
  const scope=`${user?.id??''}:${opticId??''}`;const currentScope=useRef(scope);currentScope.current=scope;
  const [loaded,setLoaded]=useState({scope:'',rows:[] as StoredOrder[],error:''});
  const [loading,setLoading]=useState(true);const [revision,setRevision]=useState(0);
  const [code,setCode]=useState('');const [name,setName]=useState('');const [filter,setFilter]=useState<OrderStatus|'all'>('all');
  const [busy,setBusy]=useState(false);const mutationLock=useRef(false);
  const [message,setMessage]=useState('');const [error,setError]=useState('');const [confirm,setConfirm]=useState<string|null>(null);
  const createRequest=useRef<{key:string;id:string}|null>(null);
  useEffect(()=>{
    if(!ready)return;let active=true;setLoading(true);
    async function load(){
      try{
        let rows:StoredOrder[]=[];
        if(mode==='supabase'&&user&&opticId){
          const db=getSupabase();if(!db)throw new Error('Supabase indisponível.');
          const result=await db.rpc('list_orders',{p_optic_id:opticId}).abortSignal(AbortSignal.timeout(15000));
          if(result.error||!Array.isArray(result.data))throw new Error('Não foi possível carregar os pedidos. Verifique sua conexão.');
          rows=result.data.map(readOrder);
        }
        if(active)setLoaded({scope,rows,error:''});
      }catch(error){if(active)setLoaded({scope,rows:[],error:error instanceof Error?error.message:'Não foi possível carregar os pedidos.'});}
      finally{if(active)setLoading(false);}
    }
    void load();return()=>{active=false;};
  },[ready,mode,user?.id,opticId,scope,revision]);
  useEffect(()=>{setCode('');setName('');setFilter('all');setMessage('');setError('');setConfirm(null);setBusy(false);mutationLock.current=false;createRequest.current=null;},[scope]);
  const disabled=busy||loading||loaded.scope!==scope||Boolean(loaded.error);
  async function mutate(rpc:'create_order'|'advance_order',args:Record<string,unknown>,success:string):Promise<boolean>{
    if(disabled||mutationLock.current||!user||!opticId)return false;
    mutationLock.current=true;setBusy(true);setMessage('');setError('');const requestScope=scope;
    try{
      const db=getSupabase();if(!db)throw new Error('Supabase indisponível.');
      const result=await db.rpc(rpc,{p_optic_id:opticId,...args}).abortSignal(AbortSignal.timeout(15000));
      if(result.error)throw new Error(rpc==='create_order'?'Não foi possível salvar o pedido. Confira os dados, o código e sua conexão; um código não pode ser repetido na mesma ótica.':'Não foi possível confirmar a alteração. O pedido pode ter mudado ou a conexão falhado. Recarregue antes de tentar novamente.');
      const saved=readOrder(result.data);
      if(saved.optic_id!==opticId||(rpc==='create_order'&&saved.code!==args.p_code)||(rpc==='advance_order'&&saved.status!==args.p_status))throw new Error('Resposta de confirmação inválida. Recarregue os pedidos.');
      if(currentScope.current!==requestScope)return false;
      setMessage(success);setConfirm(null);setRevision(value=>value+1);return true;
    }catch(error){if(currentScope.current===requestScope)setError(error instanceof Error?error.message:'Não foi possível confirmar a operação.');return false;}
    finally{if(currentScope.current===requestScope){mutationLock.current=false;setBusy(false);}}
  }
  async function create(event:FormEvent){
    event.preventDefault();const normalized=normalizeOrderCode(code);
    if(!normalized||!validTestName(name)){setError('Informe um código válido de 3 a 30 caracteres e um nome fictício de 2 a 80 caracteres. Use letras, números e hífens no código.');return;}
    const key=`${scope}:${normalized}:${name.trim()}`;
    if(createRequest.current?.key!==key)createRequest.current={key,id:crypto.randomUUID()};
    if(await mutate('create_order',{p_request_id:createRequest.current.id,p_code:normalized,p_customer_name:name.trim()},'Pedido de teste salvo.')){setCode('');setName('');createRequest.current=null;}
  }
  if(!ready)return <p className="notice" role="status">Carregando conta…</p>;
  if(mode==='demo')return <section className="completion"><h1>Os pedidos usam o Supabase local.</h1><p>A demonstração sem banco não cria pedidos nem simula avisos enviados.</p><Link href="/conta" className="primaryButton">Ver minha conta →</Link></section>;
  if(!user)return <section className="completion"><h1>Entre para acompanhar os pedidos.</h1><Link href="/conta" className="primaryButton">Entrar ou criar conta →</Link></section>;
  if(!opticId)return <section className="completion"><h1>Configure sua ótica primeiro.</h1><Link href="/configuracao" className="primaryButton">Configurar minha ótica →</Link></section>;
  const rows=loaded.scope===scope?loaded.rows:[];const visible=rows.filter(row=>filter==='all'||row.status===filter);
  return <>
    <section className="heading"><div><p className="eyebrow">DO LABORATÓRIO AO NOVO OLHAR</p><h1>Cada pedido,<br/>no seu tempo.</h1><p>Acompanhe a produção e registre quando os óculos estiverem prontos.</p></div><div className="brandMark" aria-hidden="true"><Clover/></div></section>
    <p className="notice">Pedidos de teste · Use somente nomes fictícios. Marcar como pronto gera um rascunho de aviso bloqueado para envio. Nenhuma mensagem é enviada pelo WhatsApp.</p>
    {message&&<p className="notice" role="status">{message}</p>}
    {(error||loaded.error)&&<p className="formMessage" role="alert">{error||loaded.error}<button className="textButton" onClick={()=>{setError('');setRevision(value=>value+1);}}>Recarregar pedidos</button></p>}
    <section className="configCard orderCreate"><form className="onboardingForm" noValidate onSubmit={create}><h2>Novo pedido de teste</h2><p className="formIntro">Use um código único na sua ótica, como LUM-001. O pedido começa em produção.</p><fieldset disabled={disabled}>
      <div className="orderFields"><div className="field"><label htmlFor="order-code">Código do pedido</label><input id="order-code" maxLength={30} value={code} onChange={event=>setCode(event.target.value)} placeholder="LUM-001" required/><small>Letras, números e hífens, de 3 a 30 caracteres.</small></div><div className="field"><label htmlFor="order-name">Nome fictício do cliente</label><input id="order-name" maxLength={80} value={name} onChange={event=>setName(event.target.value)} placeholder="Cliente de teste" required/></div></div>
      <button className="primaryButton" disabled={disabled}>Cadastrar pedido de teste</button>
    </fieldset></form></section>
    <div className="quoteToolbar"><label>Filtrar pedidos por status<select aria-label="Filtrar pedidos por status" value={filter} onChange={event=>setFilter(event.target.value as OrderStatus|'all')}><option value="all">Todos</option>{orderStatuses.map(status=><option value={status} key={status}>{orderStatusLabels[status]}</option>)}</select></label><button className="secondaryButton" disabled={busy||loading} onClick={()=>setRevision(value=>value+1)}>Atualizar pedidos</button></div>
    <p className="note">Últimos 100 pedidos da ótica. O simulador consulta apenas código e status, sem exibir o nome.</p>
    {loading?<p className="notice" role="status">Carregando pedidos…</p>:!visible.length?<section className="emptyState"><h2>{rows.length?'Nenhum pedido neste status.':'O próximo pedido começa aqui.'}</h2><p>{rows.length?'Escolha outro filtro para ver os demais registros.':'Cadastre um pedido fictício para testar o acompanhamento.'}</p></section>:<div className="quoteList">{visible.map(order=><article className="quoteCard orderCard" key={order.id} data-order-id={order.id}>
      <div className="quoteCardTop"><span className="badge">{orderStatusLabels[order.status]}</span><span className="label">PEDIDO DE TESTE</span></div><h2>{order.code}</h2><p className="orderCustomer">{order.customer_name}</p><p>Criado em {new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(order.created_at))} · Brasília</p>
      {order.notice_state==='blocked'&&<p className="orderNotice">Rascunho de aviso bloqueado · nenhum aviso enviado. Este registro de teste não será enviado automaticamente ao conectar o WhatsApp.</p>}
      {order.notice_state==='cancelled'&&<p className="orderNotice">Rascunho de aviso cancelado após a retirada · nenhum aviso enviado.</p>}
      {order.status==='in_production'&&<button className="primaryButton" disabled={disabled} onClick={()=>void mutate('advance_order',{p_order_id:order.id,p_expected_status:order.status,p_status:'ready'},'Pedido marcado como pronto. Rascunho de aviso bloqueado; nenhum envio realizado.')}>Marcar pronto para retirar</button>}
      {order.status==='ready'&&(confirm===order.id?<div className="cancelConfirmation"><p>Confirmar que este pedido de teste foi retirado?</p><button className="primaryButton" disabled={disabled} onClick={()=>void mutate('advance_order',{p_order_id:order.id,p_expected_status:order.status,p_status:'collected'},'Retirada registrada. O rascunho de aviso foi cancelado sem envio.')}>Confirmar retirada do pedido</button><button className="textButton" onClick={()=>setConfirm(null)}>Manter pronto para retirar</button></div>:<button className="secondaryButton" disabled={disabled} onClick={()=>setConfirm(order.id)}>Registrar retirada</button>)}
      <p className="quoteReference">Referência: {order.id}</p>
    </article>)}</div>}
  </>;
}
