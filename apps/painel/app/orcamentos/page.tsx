'use client';
import Link from 'next/link';
import {useEffect, useState} from 'react';
import {formatRange,lensLabels,treatmentLabels,quoteStatuses,statusLabels,type QuoteStatus} from '@lumi/shared';
import {useDemoSettings} from '../../components/demo-settings';
import {getSupabase} from '../../lib/supabase';
import {quoteColumns,readQuote,type StoredQuote} from '../../lib/quotes';

export default function QuotesPage() {
  const {user,mode,ready,opticId} = useDemoSettings();
  const [rows,setRows] = useState<StoredQuote[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState<string | null>(null);
  const [revision,setRevision] = useState(0);
  const [filter,setFilter] = useState<QuoteStatus | 'all'>('all');
  const scope = `${user?.id ?? ''}:${opticId ?? ''}`;
  const [loadedScope,setLoadedScope] = useState('');
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setRows([]);setLoading(true);setError('');setBusy(null);
    async function load() {
      try {
        if (mode === 'supabase' && user && opticId) {
          const db = getSupabase();
          if (!db) throw new Error('Conexão com Supabase indisponível.');
          const {data,error} = await db.from('quotes').select(quoteColumns).eq('optic_id',opticId).eq('is_demo',true).order('created_at',{ascending:false}).limit(50);
          if (error) throw new Error('Não foi possível carregar os orçamentos. Verifique sua conexão.');
          if (active) setRows((data ?? []).map(readQuote));
        }
      } catch (error) {if (active) setError(error instanceof Error ? error.message : 'Não foi possível carregar os orçamentos.');}
      finally {if (active) {setLoading(false);setLoadedScope(scope);}}
    }
    void load();
    return () => {active = false;};
  },[ready,mode,user?.id,opticId,scope,revision]);

  async function changeStatus(quote: StoredQuote, status: QuoteStatus) {
    if (busy || !user || !opticId || quote.optic_id !== opticId || !quoteStatuses.includes(status)) return;
    setBusy(quote.id);setError('');
    try {
      const db = getSupabase();if (!db) throw new Error('Conexão indisponível.');
      const {data,error} = await db.from('quotes').update({status}).eq('id',quote.id).eq('optic_id',opticId).select(quoteColumns).single();
      if (error) throw new Error('Não foi possível atualizar o status. Tente novamente.');
      const saved = readQuote(data);
      setRows(current => current.map(row => row.id === saved.id ? saved : row));
    } catch (error) {setError(error instanceof Error ? error.message : 'Não foi possível atualizar.');}
    finally {setBusy(null);}
  }
  if (!ready) return <p className="notice" role="status">Carregando conta…</p>;
  if (mode === 'supabase' && !user) return <section className="completion"><h1>Entre para acompanhar os orçamentos.</h1><Link className="primaryButton" href="/conta">Entrar ou criar conta →</Link></section>;
  if (mode === 'supabase' && !opticId) return <section className="completion"><h1>Configure sua ótica primeiro.</h1><Link className="primaryButton" href="/configuracao">Configurar minha ótica →</Link></section>;
  const visible = rows.filter(row => filter === 'all' || row.status === filter);
  return <>
    <section className="heading"><div><p className="eyebrow">CADA INTERESSE, UMA OPORTUNIDADE</p><h1>Do primeiro valor<br/>ao próximo contato.</h1><p>Acompanhe os últimos 50 orçamentos de teste da sua ótica.</p></div><div className="brandMark" aria-hidden="true">✳</div></section>
    <p className="notice">Todos os registros desta etapa são de teste, sem cliente ou receita associados. Alterar o status não envia mensagem pelo WhatsApp.</p>
    <div className="quoteToolbar"><label>Filtrar por status <select aria-label="Filtrar por status" value={filter} onChange={event => setFilter(event.target.value as QuoteStatus | 'all')}><option value="all">Todos</option>{quoteStatuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label><Link href="/" className="primaryButton">Simular orçamento →</Link></div>
    {error && <p role="alert" className="formMessage">{error}<button className="textButton" onClick={() => setRevision(value => value + 1)}>Recarregar lista</button></p>}
    {mode === 'demo' ? <section className="emptyState"><h2>Os orçamentos são salvos no modo Supabase.</h2><p>No modo de demonstração, você pode testar o cálculo com preços fictícios no simulador.</p></section> : loading || loadedScope !== scope ? <p role="status" className="notice">Carregando orçamentos…</p> : !visible.length ? <section className="emptyState"><h2>{rows.length ? 'Nenhum orçamento neste status.' : 'Seu próximo orçamento começa aqui.'}</h2><p>{rows.length ? 'Escolha outro filtro para ver os demais registros.' : 'Cadastre os preços, simule uma conversa e salve um orçamento de teste.'}</p><Link href="/precos" className="textButton">Configurar tabela de preços →</Link></section> : <div className="quoteList">{visible.map(row => <article className="quoteCard" key={row.id}>
      <div className="quoteCardTop"><span className="badge">Orçamento de teste</span><time dateTime={row.created_at}>{new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(row.created_at))} · Brasília</time></div>
      <h2>{lensLabels[row.lens_type]}</h2><p>{row.treatments.length ? row.treatments.map(key => treatmentLabels[key]).join(' · ') : 'Sem tratamentos adicionais'}</p>
      <strong className="quoteAmount">{formatRange({minimumCents:row.minimum_cents,maximumCents:row.maximum_cents})}</strong><small>Estimativa do par de lentes · valor final a confirmar</small>
      <label className="quoteStatus">Status do orçamento<select aria-label={`Status do orçamento ${row.id}`} disabled={Boolean(busy)} value={row.status} onChange={event => void changeStatus(row,event.target.value as QuoteStatus)}>{quoteStatuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
      <p className="quoteReference">Referência: {row.id}</p>
    </article>)}</div>}
  </>;
}
