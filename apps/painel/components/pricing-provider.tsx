'use client';
import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {completePriceTable, demoPriceTable, emptyPriceTable, lensTypes, treatmentTypes, readPriceTable, type PriceTable} from '@lumi/shared';
import {getSupabase} from '../lib/supabase';
import {useDemoSettings} from './demo-settings';

interface PricingContext {
  table: PriceTable;
  ready: boolean;
  error: string;
  save: (table: PriceTable) => Promise<void>;
  reload: () => void;
}
const Context = createContext<PricingContext | null>(null);
const key = 'lumi:demo:prices:v1';
export function PricingProvider({children}: {children: ReactNode}) {
  const {mode, user, opticId, ready: settingsReady} = useDemoSettings();
  const scope = `${mode}:${user?.id ?? ''}:${opticId ?? ''}`;
  const currentScope = useRef(scope); currentScope.current = scope;
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState({scope:'',table:emptyPriceTable(),error:''});
  useEffect(() => {
    if (!settingsReady) return;
    let active = true;
    async function load() {
      let table = emptyPriceTable();
      try {
        if (mode === 'demo') {
          const raw = sessionStorage.getItem(key);
          const parsed = raw ? readPriceTable(JSON.parse(raw)) : readPriceTable(demoPriceTable);
          if (!parsed || !completePriceTable(parsed)) throw new Error('A tabela de demonstração está inválida. Remova a chave lumi:demo:prices:v1 do armazenamento desta aba e recarregue.');
          table = parsed;
        } else if (user && opticId) {
          const db = getSupabase();
          if (!db) throw new Error('Conexão com o banco indisponível.');
          const [lenses,treatments] = await Promise.all([
            db.from('lens_prices').select('kind,minimum_cents,maximum_cents').eq('optic_id',opticId),
            db.from('treatment_prices').select('kind,minimum_cents,maximum_cents').eq('optic_id',opticId),
          ]);
          if (lenses.error || treatments.error) throw new Error('Não foi possível carregar os preços. Verifique o Supabase e tente novamente.');
          const result = readPriceTable({
            lenses:Object.fromEntries((lenses.data ?? []).map(row => [row.kind,{minimumCents:row.minimum_cents,maximumCents:row.maximum_cents}])),
            treatments:Object.fromEntries((treatments.data ?? []).map(row => [row.kind,{minimumCents:row.minimum_cents,maximumCents:row.maximum_cents}])),
          });
          if (!result) throw new Error('Tabela de preços inválida no banco.');
          table = result;
        }
        if (active) setLoaded({scope,table,error:''});
      } catch (error) {
        if (active) setLoaded({scope,table:emptyPriceTable(),error:error instanceof Error ? error.message : 'Não foi possível carregar a tabela.'});
      }
    }
    void load();
    return () => {active = false;};
  }, [scope, settingsReady, revision, mode, opticId, user?.id]);

  async function save(table: PriceTable) {
    if (!settingsReady || loaded.scope !== scope || loaded.error || !completePriceTable(table)) throw new Error('Carregue a tabela e preencha todas as faixas de preços antes de salvar.');
    if (mode === 'demo') {
      try {sessionStorage.setItem(key,JSON.stringify(table));} catch {throw new Error('Não foi possível salvar os preços nesta aba. Verifique o armazenamento do navegador.');}
    } else {
      const db = getSupabase();
      if (!db || !user || !opticId) throw new Error('Configure sua ótica antes de salvar os preços.');
      const {error} = await db.rpc('set_price_table', {
        p_optic_id:opticId,
        p_lenses:lensTypes.map(kind => ({kind,minimum_cents:table.lenses[kind]!.minimumCents,maximum_cents:table.lenses[kind]!.maximumCents})),
        p_treatments:treatmentTypes.map(kind => ({kind,minimum_cents:table.treatments[kind]!.minimumCents,maximum_cents:table.treatments[kind]!.maximumCents})),
      });
      if (error) throw new Error('Não foi possível salvar os preços. Somente o proprietário pode editar a tabela.');
    }
    if (currentScope.current !== scope) throw new Error('A sessão mudou. Recarregue os preços da conta atual.');
    setLoaded({scope,table:readPriceTable(table)!,error:''});
  }
  return <Context.Provider value={{table:loaded.scope === scope ? loaded.table : emptyPriceTable(), ready:settingsReady && loaded.scope === scope, error:loaded.scope === scope ? loaded.error : '',save,reload:() => {setLoaded(current => ({...current,scope:''}));setRevision(value => value + 1);}}}>{children}</Context.Provider>;
}
export function usePricing() {
  const value = useContext(Context);
  if (!value) throw new Error('PricingProvider ausente');
  return value;
}
