import type {Metadata} from 'next';
import './globals.css';
import './theme.css';
import {DemoSettingsProvider} from '../components/demo-settings';
import {PricingProvider} from '../components/pricing-provider';
import {CatalogProvider} from '../components/catalog-provider';
import {AppShell} from '../components/app-shell';
export const metadata: Metadata = {title: 'Lumi · Atendimento para óticas', description: 'Mais cuidado em cada conversa. Atendimento e tabelas de preços da sua ótica em um só lugar.'};
// Apply the saved choice before first paint, independently of React hydration.
const themeScript=`(()=>{let choice;try{choice=localStorage.getItem('lumi:theme')}catch{}document.documentElement.dataset.theme=choice==='dark'||choice==='light'?choice:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()`;
export default function Layout({children}: {children: React.ReactNode}) {return <html lang="pt-BR" data-theme="light" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body><DemoSettingsProvider><PricingProvider><CatalogProvider><AppShell>{children}</AppShell></CatalogProvider></PricingProvider></DemoSettingsProvider></body></html>;}
