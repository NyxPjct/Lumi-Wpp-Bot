'use client';
import {Clover} from '../../components/clover';
import Link from 'next/link';
import {useEffect, useState, type FormEvent} from 'react';
import {lensTypes, treatmentTypes, lensLabels, treatmentLabels, parseMoney, emptyPriceTable, completePriceTable, type PriceTable} from '@lumi/shared';
import {useDemoSettings} from '../../components/demo-settings';
import {usePricing} from '../../components/pricing-provider';

const rows = [
  ...lensTypes.map(kind => ({group:'lenses' as const,kind,label:lensLabels[kind]})),
  ...treatmentTypes.map(kind => ({group:'treatments' as const,kind,label:treatmentLabels[kind]})),
];
type Draft = Record<string,{min:string;max:string}>;
const rowKey = (row: typeof rows[number]) => `${row.group}:${row.kind}`;
function toDraft(table: PriceTable): Draft {
  return Object.fromEntries(rows.map(row => {
    const value = row.group === 'lenses' ? table.lenses[row.kind] : table.treatments[row.kind];
    return [rowKey(row),{min:value ? (value.minimumCents/100).toFixed(2).replace('.',',') : '',max:value ? (value.maximumCents/100).toFixed(2).replace('.',',') : ''}];
  }));
}
export default function PricesPage() {
  const {mode,user,ready:settingsReady,opticId} = useDemoSettings();
  const {table,ready,error,save,reload} = usePricing();
  const [draft,setDraft] = useState<Draft>(() => toDraft(emptyPriceTable()));
  const [errors,setErrors] = useState<Record<string,string>>({});
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  useEffect(() => {if (ready) {setDraft(toDraft(table));setErrors({});}},[ready,table]);
  useEffect(() => {setMessage('');},[opticId,user?.id]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    const next = emptyPriceTable(); const invalid: Record<string,string> = {};
    for (const row of rows) {
      const key = rowKey(row);
      const min = parseMoney(draft[key].min); const max = parseMoney(draft[key].max);
      if (min === null || max === null || min > max) {invalid[key] = 'Informe valores válidos, com mínimo menor ou igual ao máximo. Use vírgula para centavos, sem separador de milhar.';continue;}
      if (row.group === 'lenses') next.lenses[row.kind] = {minimumCents:min,maximumCents:max};
      else next.treatments[row.kind] = {minimumCents:min,maximumCents:max};
    }
    setErrors(invalid); setMessage('');
    if (Object.keys(invalid).length || !completePriceTable(next)) {
      document.getElementById(`${Object.keys(invalid)[0]}:min`)?.focus();return;
    }
    setBusy(true);
    try {await save(next);setMessage(mode === 'demo' ? 'Tabela de demonstração salva nesta aba.' : 'Tabela de preços salva na sua ótica.');}
    catch (error) {setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a tabela.');}
    finally {setBusy(false);}
  }
  if (!settingsReady || !ready) return <p className="notice" role="status">Carregando tabela de preços…</p>;
  if (mode === 'supabase' && !user) return <section className="completion"><h1>Entre para configurar os preços.</h1><Link className="primaryButton" href="/conta">Entrar ou criar conta →</Link></section>;
  if (mode === 'supabase' && !opticId) return <section className="completion"><h1>Primeiro, configure sua ótica.</h1><p>Os preços ficarão vinculados à sua ótica.</p><Link className="primaryButton" href="/configuracao">Configurar minha ótica →</Link></section>;
  return <>
    <section className="heading"><div><p className="eyebrow">CLAREZA DESDE O PRIMEIRO VALOR</p><h1>Uma estimativa<br/>com a sua tabela.</h1><p>Defina faixas em reais para o par de lentes e os adicionais de tratamento.</p></div><div className="brandMark" aria-hidden="true"><Clover/></div></section>
    <div className="setupBanner"><div><strong>Trabalha com tabelas de marcas e produtos?</strong><p>Importe Excel ou CSV em Tabelas. Estas faixas gerais só são usadas enquanto não houver uma tabela importada.</p></div><Link href="/tabelas">Gerenciar tabelas →</Link></div>
    <p className="notice">{mode === 'demo' ? 'Valores fictícios de demonstração, salvos somente nesta aba.' : 'Nenhum preço é preenchido automaticamente. Cadastre os valores da sua ótica.'} Os adicionais selecionados são somados à faixa base. Armação não incluída. A confirmação final é do atendente.</p>
    {error && <p className="formMessage" role="alert">{error}<button className="textButton" onClick={reload}>Tentar carregar preços novamente</button></p>}
    <form className="priceForm configCard" onSubmit={submit} noValidate>
      <fieldset disabled={busy || Boolean(error)}><legend>Valores por par de lentes</legend>
        {rows.map((row,index) => {
          const key = rowKey(row);return <div key={key}>
            {index === 3 && <h2 className="addonHeading">Adicionais por tratamento</h2>}
            <div className="priceRow"><div><strong>{row.label}</strong><small>{row.group === 'lenses' ? 'Faixa base do par' : 'Somado à faixa base'}</small></div>
              {(['min','max'] as const).map(bound => <div className="field" key={bound}><label htmlFor={`${key}:${bound}`}>{bound === 'min' ? 'Mínimo' : 'Máximo'} · R$</label><input id={`${key}:${bound}`} aria-label={`${row.label} · ${bound === 'min' ? 'Mínimo' : 'Máximo'}`} inputMode="decimal" maxLength={11} value={draft[key][bound]} onChange={event => setDraft(current => ({...current,[key]:{...current[key],[bound]:event.target.value}}))} placeholder="0,00" required aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}:error` : undefined}/></div>)}</div>
            {errors[key] && <p className="fieldError" id={`${key}:error`}>{errors[key]}</p>}
          </div>;
        })}
        <p className="note">Exemplo de preenchimento: 250,00. Use 0,00 quando não houver adicional para um tratamento oferecido.</p>
        <div className="formActions"><Link className="secondaryButton" href="/">Testar orçamento</Link><button className="primaryButton" disabled={busy || Boolean(error)}>{busy ? 'Salvando…' : 'Salvar tabela de preços'}</button></div>
      </fieldset>
    </form>
    {message && <p className="notice" role="status">{message}</p>}
  </>;
}
