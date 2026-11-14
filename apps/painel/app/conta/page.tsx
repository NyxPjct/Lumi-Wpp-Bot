'use client';

import Link from 'next/link';
import {useState, type FormEvent} from 'react';
import {getSupabase} from '../../lib/supabase';
import {useDemoSettings} from '../../components/demo-settings';

export default function AccountPage() {
  const {user, ready, mode, signOut} = useDemoSettings();
  const [action, setAction] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const db = getSupabase();
      if (!db) throw new Error('Supabase não configurado. Execute npm run db:start no ambiente de desenvolvimento.');
      const response = action === 'signup'
        ? await db.auth.signUp({email: email.trim(), password})
        : await db.auth.signInWithPassword({email: email.trim(), password});
      if (response.error) throw new Error(action === 'login' ? 'Não foi possível entrar. Confira seu e-mail e senha ou a disponibilidade do Supabase.' : 'Não foi possível criar a conta. Confira os dados ou tente entrar se já tem cadastro.');
      setPassword('');
      if (!response.data.session) setMessage('Confira seu e-mail para confirmar o cadastro antes de entrar.');
    } catch (error) {setMessage(error instanceof Error ? error.message : 'Serviço indisponível. Tente novamente.');}
    finally {setBusy(false);}
  }
  async function logout() {
    setBusy(true); setMessage('');
    try {await signOut();} catch (error) {setMessage(error instanceof Error ? error.message : 'Não foi possível sair.');}
    finally {setBusy(false);}
  }

  return <>
    <section className="heading"><div><p className="eyebrow">SEU ESPAÇO NA LUMI</p><h1>Uma conta.<br/>Sua ótica conectada.</h1><p>Cadastre-se para salvar o atendimento da sua ótica no Supabase local.</p></div><div className="brandMark" aria-hidden="true">✳</div></section>
    <p className="notice">Ambiente de desenvolvimento local. Use e-mails e senhas de teste. Nenhum e-mail real é enviado e o WhatsApp ainda não está conectado.</p>
    {message && <p className="formMessage" role="alert">{message}</p>}
    {!ready ? <p role="status">Verificando sessão…</p> : user ? <section className="completion">
      <p className="eyebrow">CONTA CONECTADA</p><h2>Bem-vindo à Lumi.</h2><p data-testid="account-email">{user.email}</p><p>As configurações da sua ótica ficam no banco local e podem ser recuperadas ao entrar novamente.</p>
      <div className="actions"><Link className="primaryButton" href="/configuracao">Configurar minha ótica →</Link><button className="secondaryButton" disabled={busy} onClick={logout}>Sair da conta</button></div>
    </section> : mode === 'demo' ? <section className="completion"><h2>Supabase ainda não está conectado</h2><p>Inicie o serviço local com <code>npm run db:start</code> e reinicie o painel. O modo de demonstração continua disponível sem uma conta.</p><Link href="/" className="primaryButton">Voltar ao simulador</Link></section> : <section className="configCard accountCard">
      <div className="accountTabs"><button type="button" className={action === 'signup' ? 'selected' : ''} aria-pressed={action === 'signup'} disabled={busy} onClick={() => {setAction('signup'); setMessage('');}}>Criar conta</button><button type="button" className={action === 'login' ? 'selected' : ''} aria-pressed={action === 'login'} disabled={busy} onClick={() => {setAction('login'); setMessage('');}}>Entrar</button></div>
      <form className="onboardingForm" onSubmit={submit}>
        <h2>{action === 'signup' ? 'Comece pela sua conta' : 'Bom ter você de volta'}</h2><p className="formIntro">{action === 'signup' ? 'Depois do cadastro, você configura os dados da sua ótica.' : 'Entre para acessar os dados que você já salvou.'}</p>
        <div className="field"><label htmlFor="account-email">E-mail</label><input id="account-email" type="email" autoComplete="email" maxLength={254} required value={email} disabled={busy} onChange={event => setEmail(event.target.value)}/></div>
        <div className="field"><label htmlFor="account-password">Senha</label><input id="account-password" type="password" autoComplete={action === 'signup' ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required value={password} disabled={busy} onChange={event => setPassword(event.target.value)} aria-describedby="password-help"/><small id="password-help">Use uma senha de teste com pelo menos 8 caracteres.</small></div>
        <button className="primaryButton" disabled={busy} type="submit">{busy ? 'Aguarde…' : action === 'signup' ? 'Criar minha conta' : 'Entrar na Lumi'}</button>
      </form>
    </section>}
  </>;
}
