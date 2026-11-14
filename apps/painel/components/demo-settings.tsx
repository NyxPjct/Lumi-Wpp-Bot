'use client';

import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {validateSettings, type BusinessSettings} from '@lumi/shared';
import {getSupabase} from '../lib/supabase';
import type {SupabaseClient, User} from '@supabase/supabase-js';

const storageKey = 'lumi:demo:settings:v1';
interface SettingsContext {
  settings: BusinessSettings | null;
  ready: boolean;
  opticId: string | null;
  mode: 'demo' | 'supabase';
  user: User | null;
  storageWarning: string;
  save: (settings: BusinessSettings) => Promise<void>;
  clear: () => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
}
const Context = createContext<SettingsContext | null>(null);

export function DemoSettingsProvider({children}: {children: ReactNode}) {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'demo' | 'supabase'>('demo');
  const [storageWarning, setStorageWarning] = useState('');
  const opticId = useRef<string | null>(null);
  const version = useRef(0);
  const currentUserId = useRef<string | null>(null);
  const supabase = useRef<SupabaseClient | null>(null);

  async function loadUser(nextUser: User | null) {
    const request = ++version.current;
    currentUserId.current = nextUser?.id ?? null;
    setReady(false); setSettings(null); opticId.current = null; setUser(nextUser);
    setStorageWarning('');
    try {
      if (nextUser && supabase.current) {
        const {data, error} = await supabase.current.from('optics').select('id,name,address,hours,payments,delivery').maybeSingle();
        if (error) throw new Error('Não foi possível carregar os dados da ótica. Verifique o Supabase local e tente novamente.');
        if (request !== version.current) return;
        if (data) {
          const result = validateSettings(data);
          if (!result.ok) throw new Error('A configuração salva está inválida. Revise os dados no banco.');
          setSettings(result.value); opticId.current = data.id;
        }
      }
    } catch (error) {
      if (request === version.current) setStorageWarning(error instanceof Error ? error.message : 'Não foi possível carregar os dados.');
    } finally {if (request === version.current) setReady(true);}
  }

  useEffect(() => {
    let active = true;
    let subscription: {unsubscribe: () => void} | undefined;
    try {
      const db = getSupabase();
      supabase.current = db;
      if (db) {
        setMode('supabase');
        // Auth callbacks must not await a database request while the auth lock is held.
        subscription = db.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session?.user.id === currentUserId.current) return;
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
            setTimeout(() => {if (active) void loadUser(session?.user ?? null);}, 0);
          }
        }).data.subscription;
        db.auth.getSession().then(({error}) => {
          if (active && error) {setStorageWarning('Sessão indisponível. Entre novamente na sua conta.'); setReady(true);}
        });
      } else {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw);
          const result = validateSettings(saved?.settings);
          if (saved?.version === 1 && result.ok) setSettings(result.value);
          else setStorageWarning('A configuração local não pôde ser carregada. Você pode preencher os dados novamente.');
        }
        setReady(true);
      }
    } catch (error) {
      // A partially configured connection must fail closed, never silently switch to demo.
      const configured = process.env.NEXT_PUBLIC_LUMI_MODE !== 'demo' && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      if (configured) setMode('supabase');
      setStorageWarning(configured && error instanceof Error ? error.message : 'Não foi possível acessar a configuração local. Verifique o armazenamento do navegador.');
      setReady(true);
    }
    return () => {active = false; version.current++; subscription?.unsubscribe();};
  }, []);

  async function reload() {
    if (!supabase.current) return;
    const {data, error} = await supabase.current.auth.getUser();
    if (error) throw new Error('Não foi possível verificar a sessão. Entre novamente.');
    await loadUser(data.user);
  }

  async function save(input: BusinessSettings) {
    const result = validateSettings(input);
    if (!result.ok) throw new Error('Revise os dados da ótica antes de salvar.');
    const db = supabase.current;
    if (mode === 'supabase') {
      if (!db || !user || !ready || storageWarning) throw new Error('Entre na conta e carregue os dados da ótica antes de salvar.');
      const request = version.current;
      if (opticId.current) {
        const {data, error} = await db.from('optics').update(result.value).eq('id', opticId.current).select('id').single();
        if (error || !data) throw new Error('Não foi possível salvar a ótica. Verifique sua conexão e permissão.');
      } else {
        const {data, error} = await db.rpc('create_optic', {
          p_name: result.value.name, p_address: result.value.address, p_hours: result.value.hours,
          p_payments: result.value.payments, p_delivery: result.value.delivery,
        });
        if (error || !data) throw new Error('Não foi possível criar a ótica. Recarregue os dados antes de tentar novamente.');
        if (request === version.current) opticId.current = data;
      }
      if (request !== version.current) throw new Error('A sessão mudou durante o salvamento. Entre novamente.');
    } else {
      try {sessionStorage.setItem(storageKey, JSON.stringify({version: 1, settings: result.value}));} catch {
        throw new Error('Não foi possível salvar nesta aba. Libere o armazenamento do navegador e tente novamente.');
      }
    }
    setSettings(result.value); setStorageWarning('');
  }

  async function clear() {
    if (mode === 'supabase') throw new Error('A exclusão de óticas não está disponível pelo painel.');
    try {sessionStorage.removeItem(storageKey);} catch {
      throw new Error('Não foi possível apagar a configuração local. Verifique o armazenamento do navegador.');
    }
    setSettings(null); setStorageWarning('');
  }

  async function signOut() {
    const db = supabase.current;
    if (!db) return;
    const {error} = await db.auth.signOut({scope: 'local'});
    if (error) throw new Error('Não foi possível sair da conta. Tente novamente.');
    await loadUser(null);
  }
  return <Context.Provider value={{settings, ready, opticId: opticId.current, mode, user, storageWarning, save, clear, signOut, reload}}>{children}</Context.Provider>;
}

export function useDemoSettings() {
  const context = useContext(Context);
  if (!context) throw new Error('SettingsProvider ausente');
  return context;
}
