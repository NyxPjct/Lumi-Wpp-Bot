import type {Metadata} from 'next';
import './globals.css';
import {DemoSettingsProvider} from '../components/demo-settings';
import {PricingProvider} from '../components/pricing-provider';
import {AppShell} from '../components/app-shell';
export const metadata: Metadata = {title: 'Lumi · Atendimento para óticas', description: 'Demonstração do atendimento Lumi para óticas.'};
export default function Layout({children}: {children: React.ReactNode}) {return <html lang="pt-BR"><body><DemoSettingsProvider><PricingProvider><AppShell>{children}</AppShell></PricingProvider></DemoSettingsProvider></body></html>;}
