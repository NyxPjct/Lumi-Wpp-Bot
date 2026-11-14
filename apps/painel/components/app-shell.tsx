'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useDemoSettings} from './demo-settings';

export function AppShell({children}: {children: React.ReactNode}) {
  const path = usePathname();
  const {settings, storageWarning, mode, user, reload} = useDemoSettings();
  const configuring = path === '/configuracao';
  const title = ({'/':'Simulador','/configuracao':'Configuração da ótica','/precos':'Tabela de preços','/orcamentos':'Orçamentos','/conta':'Minha conta'} as Record<string,string>)[path] ?? 'Painel';
  return <div className="shell">
    <aside>
      <Link className="logo" href="/">✳ <span>Lumi<span className="dot">.</span></span></Link>
      <p className="label">ESPAÇO DA ÓTICA</p>
      <div className="store"><span className="storeIcon">◈</span><div>{settings?.name ?? 'Ótica demonstração'}<small>{mode === 'supabase' ? 'Supabase local' : 'Ambiente de testes'}</small></div></div>
      <nav aria-label="Menu principal">
        <Link className={path === '/' ? 'active' : ''} aria-current={path === '/' ? 'page' : undefined} href="/">◉ <span>Simulador de conversa</span></Link>
        <Link className={configuring ? 'active' : ''} aria-current={configuring ? 'page' : undefined} href="/configuracao">⚙ <span>Configurar minha ótica</span></Link>
        <Link className={path === '/precos' ? 'active' : ''} aria-current={path === '/precos' ? 'page' : undefined} href="/precos">◇ <span>Tabela de preços</span></Link>
        <Link className={path === '/orcamentos' ? 'active' : ''} aria-current={path === '/orcamentos' ? 'page' : undefined} href="/orcamentos">▤ <span>Orçamentos</span></Link>
        <Link className={path === '/conta' ? 'active' : ''} href="/conta">◈ <span>{user ? 'Minha conta' : 'Entrar ou criar conta'}</span></Link>
      </nav>
      <div className="asideBottom"><span className="live"/> Seu próximo atendimento,<br/>com mais clareza.</div>
    </aside>
    <main>
      <header><span>Painel <span className="slash">/</span> {title}</span><span className="badge">{mode === 'supabase' ? 'Supabase local' : 'Dados fictícios'}</span></header>
      <nav className="mobileNav" aria-label="Navegação móvel"><Link href="/">Simulador</Link><Link href="/configuracao">Configurar minha ótica</Link><Link href="/precos">Preços</Link><Link href="/orcamentos">Orçamentos</Link><Link href="/conta">Conta</Link></nav>
      {storageWarning && <p className="notice" role="status">{storageWarning}{mode === 'supabase' && user && <button className="textButton" onClick={() => {void reload().catch(() => {});}}>Tentar carregar novamente</button>}</p>}
      {children}
      <footer>Lumi · Feita para cuidar de cada conversa.</footer>
    </main>
  </div>;
}
