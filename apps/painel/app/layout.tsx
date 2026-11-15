import type {Metadata} from 'next';
import './globals.css';
import {DemoSettingsProvider} from '../components/demo-settings';
import {PricingProvider} from '../components/pricing-provider';
import {CatalogProvider} from '../components/catalog-provider';
import {AppShell} from '../components/app-shell';
export const metadata: Metadata = {title: 'Lumi · Atendimento para óticas', description: 'Mais cuidado em cada conversa. Atendimento e tabelas de preços da sua ótica em um só lugar.'};
export default function Layout({children}: {children: React.ReactNode}) {return <html lang="pt-BR"><body><DemoSettingsProvider><PricingProvider><CatalogProvider><AppShell>{children}</AppShell></CatalogProvider></PricingProvider></DemoSettingsProvider></body></html>;}
