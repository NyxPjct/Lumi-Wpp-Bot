import {createClient, type SupabaseClient} from '@supabase/supabase-js';

let client: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient | null {
  if (process.env.NEXT_PUBLIC_LUMI_MODE === 'demo') return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url && !key) return null;
  if (!url || !key) throw new Error('Configuração do Supabase incompleta. Execute npm run db:configure e reinicie o painel.');
  if (key.startsWith('sb_secret_')) throw new Error('Use somente a chave pública do Supabase no painel.');
  if (key.split('.').length === 3) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon') throw new Error('Use somente a chave anon do Supabase no painel.');
    } catch {throw new Error('Chave pública do Supabase inválida ou com permissões administrativas.');}
  }
  return client ??= createClient(url, key);
}
