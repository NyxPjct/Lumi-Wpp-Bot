'use client';
import {useState, useRef, useEffect} from 'react';
import {initialConversation,transition,welcomeForSettings,formatRange,lensLabels,treatmentLabels,type Conversation,type QuoteEstimate} from '@lumi/shared';
import Link from 'next/link';
import {useDemoSettings} from '../components/demo-settings';
import {usePricing} from '../components/pricing-provider';
import {getSupabase} from '../lib/supabase';
import {createTestQuote,type StoredQuote} from '../lib/quotes';
interface Message {role: 'bot' | 'client'; text: string}
interface DraftQuote {requestId:string; estimate:QuoteEstimate; saved?:StoredQuote}
export default function Page() {
  const {settings,ready,mode,user,opticId} = useDemoSettings();
  const pricing = usePricing();
  const welcome = welcomeForSettings(settings);
  const [conversation,setConversation] = useState<Conversation>(initialConversation);
  const [messages,setMessages] = useState<Message[]>([{role:'bot',text:welcome}]);
  const [input,setInput] = useState('');
  const [draft,setDraft] = useState<DraftQuote | null>(null);
  const [saving,setSaving] = useState(false);
  const [saveError,setSaveError] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {end.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[messages]);
  useEffect(() => {setConversation(initialConversation());setMessages([{role:'bot',text:welcome}]);setInput('');setDraft(null);setSaveError('');},[welcome,user?.id,opticId]);
  const enabled = ready && pricing.ready && !saving;
  function send(text: string) {
    if (!enabled || !text.trim() || text.length > 1000 || conversation.state === 'encerrado') return;
    const result = transition(conversation,text,undefined,settings,pricing.table);
    if (result.conversation.quoteResult && !conversation.quoteResult) setDraft({requestId:crypto.randomUUID(),estimate:result.conversation.quoteResult});
    if (!result.conversation.quoteResult) {setDraft(null);setSaveError('');}
    setMessages(previous => [...previous,{role:'client',text},...result.replies.map(reply => ({role:'bot' as const,text:reply}))]);
    setConversation(result.conversation);setInput('');
  }
  function reset() {setMessages([{role:'bot',text:welcome}]);setConversation(initialConversation());setInput('');setDraft(null);setSaveError('');}
  async function saveQuote() {
    if (!draft || draft.saved || saving || mode !== 'supabase' || !user || !opticId) return;
    const requestId = draft.requestId;
    setSaving(true);setSaveError('');
    try {
      const db = getSupabase();if (!db) throw new Error('Conexão com o Supabase indisponível.');
      const saved = await createTestQuote(db,opticId,requestId,draft.estimate);
      setDraft(current => current?.requestId === requestId ? {...current,saved} : current);
    } catch (error) {setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar o orçamento.');}
    finally {setSaving(false);}
  }
  if (ready && mode === 'supabase' && !user) return <section className="completion"><p className="eyebrow">BEM-VINDO À LUMI</p><h1>Seu atendimento<br/>começa aqui.</h1><p>Crie uma conta ou entre para configurar sua ótica e testar o atendimento.</p><Link className="primaryButton" href="/conta">Entrar ou criar conta →</Link></section>;
  return <>
    <section className="heading"><div><p className="eyebrow">ATENDIMENTO QUE APROXIMA</p><h1>Um novo olhar para<br/>suas conversas.</h1><p>Conheça a Lumi, sua assistente de atendimento para óticas.<br/>Experimente uma conversa ou um orçamento de lentes.</p></div><div className="brandMark" aria-hidden="true">✳</div></section>
    <div className="setupBanner"><div><strong>{settings ? `Atendimento da ${settings.name}` : 'Vamos dar a sua cara à Lumi?'}</strong><p>{settings ? mode === 'demo' ? 'Respostas configuradas nesta aba · WhatsApp não conectado' : 'Respostas salvas no Supabase · WhatsApp não conectado' : 'Configure os dados da ótica e teste suas próprias respostas.'}</p></div><Link href="/configuracao">{settings ? 'Editar configuração' : 'Configurar minha ótica'} →</Link></div>
    {pricing.error && <p className="formMessage" role="alert">{pricing.error}<button className="textButton" onClick={pricing.reload}>Recarregar preços</button></p>}
    <section className="workspace" id="simulador"><div className="chat">
      <div className="chatHeader"><div className="avatar">L</div><div><strong>Lumi</strong><small><span className="live"/>{conversation.state === 'humano' ? 'Aguardando atendente' : conversation.state === 'encerrado' ? 'Encerrado' : 'Assistente virtual · Simulação'}</small></div><button className="reset" disabled={saving} onClick={reset}>↻ Reiniciar</button></div>
      <div className="messages" aria-live="polite"><div className="date">CONVERSA DE DEMONSTRAÇÃO</div>{messages.map((message,index) => <div key={index} className={`message ${message.role}`}><span>{message.text}</span><small>{message.role === 'bot' ? 'Lumi' : 'Você'}</small></div>)}<div ref={end}/></div>
      <div className="composer">
        {conversation.state === 'privacidade' && <div className="quick"><button disabled={!enabled} onClick={() => send('aceito')}>Aceito continuar</button><button disabled={!enabled} onClick={() => send('não aceito')}>Não aceito</button></div>}
        {conversation.state === 'menu' && <div className="quick"><button disabled={!enabled} onClick={() => send('1')}>Orçamento de lentes</button><button disabled={!enabled} onClick={() => send('5')}>Dúvidas frequentes</button><button disabled={!enabled} onClick={() => send('6')}>Falar com atendente</button></div>}
        <form onSubmit={event => {event.preventDefault();send(input);}}><input aria-label="Sua mensagem" maxLength={1000} value={input} onChange={event => setInput(event.target.value)} placeholder="Digite uma mensagem…" disabled={!enabled || conversation.state === 'encerrado'}/><button aria-label="Enviar mensagem" disabled={!enabled || !input.trim() || conversation.state === 'encerrado'}>↑</button></form><p>Simulação local · Não envia mensagens ao WhatsApp</p>
      </div>
    </div>
    <div className="details">
      {draft && <section className="statusCard quoteSummary"><p className="label">ORÇAMENTO DE TESTE</p><h2>{lensLabels[draft.estimate.lensType]}</h2><p>{draft.estimate.treatments.length ? draft.estimate.treatments.map(key => treatmentLabels[key]).join(' · ') : 'Sem tratamentos adicionais'}</p><strong>{formatRange(draft.saved ? {minimumCents:draft.saved.minimum_cents,maximumCents:draft.saved.maximum_cents} : draft.estimate)}</strong><p className="note">Par de lentes, sem armação. Valor final a confirmar com atendente. Sem receita ou dados de cliente.</p>
        {draft.saved ? <div role="status"><p>Orçamento de teste salvo.</p>{(draft.saved.minimum_cents !== draft.estimate.minimumCents || draft.saved.maximum_cents !== draft.estimate.maximumCents) && <p>A tabela mudou. A faixa acima foi recalculada pelo banco ao salvar.</p>}<Link className="textButton" href="/orcamentos">Ver orçamentos →</Link></div> : mode === 'supabase' && opticId ? <button className="primaryButton" disabled={saving} onClick={() => void saveQuote()}>{saving ? 'Salvando…' : 'Salvar orçamento de teste'}</button> : <p className="note">O modo de demonstração não salva orçamentos. Use o Supabase local com uma ótica configurada.</p>}
        {saveError && <p className="fieldError" role="alert">{saveError}</p>}
      </section>}
      <section className="infoCard"><span className="miniIcon">✧</span><h2>Teste o atendimento completo</h2><p>Experimente o orçamento com as preferências do cliente e confirme a faixa antes do contato humano.</p><ol><li>Autorize o atendimento</li><li>Escolha o tipo de lente e tratamentos</li><li>Confira a estimativa e encaminhe</li></ol><Link className="textButton" href="/precos">Configurar tabela de preços →</Link></section>
      <section className="statusCard"><span className="label">ESTADO DA CONVERSA</span><div className="state">{({privacidade:'Consentimento',menu:'Menu principal',faq:'Dúvidas frequentes',quote_lens:'Tipo de lente',quote_treatments:'Tratamentos',humano:'Atendimento humano',encerrado:'Encerrada'})[conversation.state]}</div><div className="statusRow"><span>Consentimento</span><strong>{conversation.consentedAt ? 'Registrado na sessão' : 'Não concedido'}</strong></div><div className="statusRow"><span>Modo</span><strong>{conversation.state === 'humano' ? 'Bot pausado' : 'Automático'}</strong></div>{conversation.state === 'humano' && <button className="returnBot" disabled={saving} onClick={() => {setConversation(current => ({...current,state:'privacidade',invalidAttempts:0,quoteLens:undefined,quoteResult:undefined}));setDraft(null);setSaveError('');setMessages(current => [...current,{role:'bot',text:welcome}]);}}>Devolver ao bot</button>}</section>
      <p className="note">Use somente dados fictícios. Gerencie agendamentos de teste na tela Agenda. Receitas, pedidos e integração real com o WhatsApp ainda não estão disponíveis.</p>
    </div></section>
  </>;
}
