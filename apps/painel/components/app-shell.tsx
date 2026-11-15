'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useDemoSettings} from './demo-settings';
import {Clover} from './clover';

export function AppShell({children}: {children: React.ReactNode}) {
  const path = usePathname();
  const {settings, storageWarning, mode, user, reload} = useDemoSettings();
  const configuring = path === '/configuracao';
  const title = ({'/':'Simulador','/configuracao':'Configuração da ótica','/tabelas':'Tabelas de preços','/precos':'Faixas gerais de preços','/orcamentos':'Orçamentos','/conta':'Minha conta','/agenda':'Agenda','/pedidos':'Pedidos'} as Record<string,string>)[path] ?? 'Painel';
  return <div className="shell">
    <aside>
      <Link className="logo" href="/" aria-label="Lumi · Início"><span className="logoSymbol"><Clover/></span><span>Lumi<span className="dot">.</span></span></Link>
      <p className="label">ESPAÇO DA ÓTICA</p>
      <div className="store"><span className="storeIcon"><StoreIcon/></span><div>{settings?.name ?? 'Sua ótica'}<small>{mode === 'supabase' ? 'Espaço de trabalho' : 'Ambiente de demonstração'}</small></div></div>
      <nav aria-label="Menu principal">
        <Link className={path === '/' ? 'active' : ''} aria-current={path === '/' ? 'page' : undefined} href="/"><MenuIcon kind="chat"/><span>Simulador de conversa</span></Link>
        <Link className={path === '/tabelas'||path==='/precos' ? 'active' : ''} aria-current={path === '/tabelas' ? 'page' : undefined} href="/tabelas"><MenuIcon kind="tables"/><span>Tabelas de preços</span><span className="navNew">Novo</span></Link>
        <Link className={path === '/orcamentos' ? 'active' : ''} aria-current={path === '/orcamentos' ? 'page' : undefined} href="/orcamentos"><MenuIcon kind="quotes"/><span>Orçamentos</span></Link>
        <Link className={path === '/agenda' ? 'active' : ''} aria-current={path === '/agenda' ? 'page' : undefined} href="/agenda"><MenuIcon kind="agenda"/><span>Agenda</span></Link>
        <Link className={path === '/pedidos' ? 'active' : ''} aria-current={path === '/pedidos' ? 'page' : undefined} href="/pedidos"><MenuIcon kind="orders"/><span>Pedidos</span></Link>
        <Link className={configuring ? 'active' : ''} aria-current={configuring ? 'page' : undefined} href="/configuracao"><MenuIcon kind="settings"/><span>Configurar minha ótica</span></Link>
        <Link className={path === '/conta' ? 'active' : ''} href="/conta"><MenuIcon kind="account"/><span>{user ? 'Minha conta' : 'Entrar ou criar conta'}</span></Link>
      </nav>
      <div className="asideBottom"><Clover/><strong>Um pouco de sorte.<br/>Muito cuidado.</strong><p>Mais leveza para a sua ótica,<br/>mais atenção a cada cliente.</p><span className="live"/> Lumi · Feita para óticas</div>
    </aside>
    <main>
      <header><span className="breadcrumb"><Clover/>Painel <span className="slash">/</span> <strong>{title}</strong></span><span className="badge"><span className="live"/>{mode === 'supabase' ? 'Ambiente local' : 'Demonstração'}</span></header>
      <nav className="mobileNav" aria-label="Navegação móvel"><Link href="/">Simulador</Link><Link href="/tabelas">Tabelas</Link><Link href="/orcamentos">Orçamentos</Link><Link href="/agenda">Agenda</Link><Link href="/pedidos">Pedidos</Link><Link href="/configuracao">Configurar minha ótica</Link><Link href="/conta">Conta</Link></nav>
      {storageWarning && <p className="notice" role="status">{storageWarning}{mode === 'supabase' && user && <button className="textButton" onClick={() => {void reload().catch(() => {});}}>Tentar carregar novamente</button>}</p>}
      {children}
      <footer>Lumi · Feita para cuidar de cada conversa.</footer>
    </main>
  </div>;
}
function StoreIcon(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m3 9 2-5h14l2 5v3a3 3 0 0 1-4 2 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-4-2V9Zm2 6v6h14v-6M9 21v-5h6v5M3 9h18"/></svg>;}
function MenuIcon({kind}:{kind:string}){
  const paths:Record<string,string>={chat:'M4 4h16v12H9l-5 4V4Z M8 8h8M8 12h5',tables:'M4 4h16v16H4V4Zm0 5h16M4 14h16M10 4v16',quotes:'M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6',agenda:'M4 6h16v15H4V6ZM8 3v6M16 3v6M4 11h16M8 15h2M14 15h2',orders:'m3 7 9-4 9 4v12l-9 3-9-3V7Zm0 0 9 4 9-4M12 11v11M7 5l10 4',settings:'M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',account:'M4 21v-3a8 8 0 0 1 16 0v3M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z'};
  return <svg className="menuIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]}/></svg>;
}
