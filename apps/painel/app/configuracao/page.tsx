'use client';
import {Clover} from '../../components/clover';

import Link from 'next/link';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {emptySettings, validateSettings, type BusinessField, type BusinessSettings, type SettingsErrors} from '@lumi/shared';
import {useDemoSettings} from '../../components/demo-settings';

const steps = ['Sua ótica', 'Atendimento', 'WhatsApp'];
const fields: {key: BusinessField; label: string; placeholder: string; hint: string; step: number}[] = [
  {key: 'name', label: 'Nome da ótica', placeholder: 'Ex.: Ótica Boa Vista', hint: 'Como a Lumi apresenta sua ótica aos clientes.', step: 0},
  {key: 'address', label: 'Endereço', placeholder: 'Ex.: Rua das Flores, 120 · Centro', hint: 'Inclua cidade e uma referência, se necessário.', step: 0},
  {key: 'hours', label: 'Horário de atendimento', placeholder: 'Ex.: Segunda a sexta, das 9h às 18h; sábado, das 9h às 13h.', hint: 'Inclua os dias e horários de funcionamento.', step: 1},
  {key: 'payments', label: 'Formas de pagamento', placeholder: 'Ex.: Pix e cartões. Parcelamento em até 3 vezes.', hint: 'Informe somente condições que sua ótica oferece.', step: 1},
  {key: 'delivery', label: 'Prazo dos óculos', placeholder: 'Ex.: O prazo é confirmado após a escolha das lentes.', hint: 'A Lumi usa esta resposta sem estimar prazos por conta própria.', step: 1},
];

export default function Configuration() {
  const {settings, ready, save, clear, mode, user} = useDemoSettings();
  const [draft, setDraft] = useState<BusinessSettings>({...emptySettings});
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(0);

  useEffect(() => {if (ready) setDraft(settings ? {...settings} : {...emptySettings});}, [ready, settings]);
  useEffect(() => {
    if (previousStep.current !== step) title.current?.focus();
    previousStep.current = step;
  }, [step]);

  function validateStep() {
    const result = validateSettings(draft);
    const relevant: SettingsErrors = {};
    if (!result.ok) for (const {key} of fields.filter(field => field.step === step)) {
      if (result.errors[key]) relevant[key] = result.errors[key];
    }
    setErrors(relevant);
    if (Object.keys(relevant).length) {
      document.getElementById(Object.keys(relevant)[0])?.focus();
      return false;
    }
    return true;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setMessage('');
    if (step < 2) {
      if (validateStep()) setStep(current => current + 1);
      return;
    }
    const result = validateSettings(draft);
    if (!result.ok) {
      setErrors(result.errors);
      setStep(result.errors.name || result.errors.address ? 0 : 1);
      setMessage('Revise os campos indicados antes de continuar.');
      return;
    }
    setBusy(true);
    try {await save(result.value); setComplete(true);} catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.');
    } finally {setBusy(false);}
  }

  async function reset() {
    try {
      await clear(); setDraft({...emptySettings}); setStep(0); setErrors({});
      setConfirmReset(false); setComplete(false); setMessage('Configuração local apagada.');
    } catch (error) {setMessage(error instanceof Error ? error.message : 'Não foi possível apagar a configuração.');}
  }

  if (ready && mode === 'supabase' && !user) return <section className="completion"><p className="eyebrow">CONFIGURAÇÃO DA ÓTICA</p><h1>Comece pela sua conta.</h1><p>Entre ou cadastre-se para salvar os dados da sua ótica no Supabase local.</p><Link className="primaryButton" href="/conta">Entrar ou criar conta →</Link></section>;

  return <>
    <section className="heading configHeading"><div><p className="eyebrow">SUA ÓTICA, DO SEU JEITO</p><h1>Prepare o primeiro<br/>“olá” da Lumi.</h1><p>Personalize o atendimento e conheça a etapa de conexão do WhatsApp.</p></div><div className="brandMark" aria-hidden="true"><Clover/></div></section>
    <p className="notice">{mode === 'demo' ? 'Demonstração: use dados fictícios. A configuração fica somente nesta aba do navegador. Esta etapa não cria uma conta.' : 'Supabase local: a configuração será salva na sua conta. O WhatsApp continua desconectado; use dados de teste.'}</p>
    {message && <p className="formMessage" role="alert">{message}</p>}
    {!ready ? <p role="status">Carregando configuração…</p> : complete ? <section className="completion" aria-labelledby="complete-title">
      <span className="completeIcon" aria-hidden="true">✓</span><p className="eyebrow">TUDO PRONTO PARA TESTAR</p><h2 id="complete-title">{mode === 'demo' ? 'Sua demonstração está personalizada.' : 'Configurações salvas na sua ótica.'}</h2>
      <p>A Lumi já pode usar as respostas da <strong>{draft.name}</strong> no simulador.</p><p className="connectionState">WhatsApp não conectado · {mode === 'demo' ? 'Configuração local' : 'Salvo no Supabase local'}</p>
      <div className="actions"><Link className="primaryButton" href="/">Testar atendimento →</Link><button type="button" className="secondaryButton" onClick={() => {setComplete(false); setStep(0);}}>Editar dados</button></div>
    </section> : <div className="onboardingGrid">
      <section className="configCard">
        <ol className="steps" aria-label="Etapas de configuração">{steps.map((label, index) => <li key={label} className={index === step ? 'current' : index < step ? 'done' : ''} aria-current={index === step ? 'step' : undefined}><span>{index < step ? '✓' : index + 1}</span>{label}</li>)}</ol>
        <form className="onboardingForm" noValidate onSubmit={submit}>
          <p className="eyebrow">ETAPA {step + 1} DE 3</p>
          <h2 ref={title} tabIndex={-1}>{['Vamos conhecer sua ótica', 'O que seus clientes precisam saber?', 'Conecte seu próprio WhatsApp'][step]}</h2>
          <p className="formIntro">{['Esses dados identificam sua ótica no atendimento.', 'Escreva as respostas que a Lumi deve usar nas dúvidas frequentes.', 'A autorização será feita pela própria ótica, com a conta comercial dela.'][step]}</p>
          {fields.filter(field => field.step === step).map(field => <div className="field" key={field.key}>
            <label htmlFor={field.key}>{field.label} <span aria-hidden="true">*</span></label>
            <textarea id={field.key} rows={field.key === 'name' ? 1 : 3} maxLength={field.key === 'name' ? 80 : 300} value={draft[field.key]} onChange={event => setDraft(current => ({...current, [field.key]: event.target.value}))} placeholder={field.placeholder} required aria-invalid={Boolean(errors[field.key])} aria-describedby={`${field.key}-hint${errors[field.key] ? ` ${field.key}-error` : ''}`}/>
            <small id={`${field.key}-hint`}>{field.hint}</small>
            {errors[field.key] && <p className="fieldError" id={`${field.key}-error`}>{errors[field.key]}</p>}
          </div>)}
          {step === 2 && <div className="connectionCard">
            <div className="connectionTitle"><span className="waIcon" aria-hidden="true">↗</span><div><h3>WhatsApp da sua ótica</h3><span className="connectionState">Não conectado</span></div></div>
            <p>Quando a integração estiver disponível, você vai autorizar o acesso pela Meta e selecionar o número comercial da sua ótica, sem copiar tokens para a Lumi.</p>
            <button className="connectButton" type="button" disabled aria-describedby="connection-help">Conectar meu WhatsApp</button>
            <p id="connection-help" className="connectionHelp">Conexão real ainda indisponível nesta demonstração. Você já pode salvar os dados e testar o atendimento no simulador.</p>
            <details><summary>Como será a conexão?</summary><ol><li>Entre na sua conta da Meta.</li><li>Autorize a Lumi e selecione a conta comercial e o número elegível.</li><li>A Lumi valida o vínculo com sua ótica e exibe o estado da conexão.</li></ol><p>O uso conjunto com o WhatsApp Business depende da elegibilidade do número e das regras vigentes da Meta.</p></details>
          </div>}
          <div className="formActions">{step > 0 && <button className="secondaryButton" type="button" disabled={busy} onClick={() => {setStep(current => current - 1); setMessage('');}}>Voltar</button>}<button className="primaryButton" type="submit" disabled={busy}>{busy ? 'Salvando…' : step === 2 ? mode === 'demo' ? 'Salvar e testar demonstração' : 'Salvar configurações' : 'Continuar →'}</button></div>
        </form>
      </section>
      <div className="details configDetails"><section className="infoCard"><span className="miniIcon">✧</span><h2>Uma Lumi com a sua voz</h2><p>As respostas que você cadastrar aqui aparecem no simulador. Confira tudo antes de levar seu atendimento para o WhatsApp.</p><ul><li>Informações claras sobre sua ótica</li><li>Respostas sem inventar condições</li><li>Transferência para um atendente</li></ul></section>
        <section className="statusCard"><p className="label">PRÉVIA DA APRESENTAÇÃO</p><p className="greetingPreview">Olá! Sou a Lumi, assistente da {draft.name.trim() || 'sua ótica'}. Como posso ajudar?</p><p className="note">O atendimento começa com o pedido de consentimento.</p></section>
        {settings && mode === 'demo' && <section className="resetSettings"><p>Quer recomeçar a configuração local?</p>{!confirmReset ? <button className="textButton" onClick={() => setConfirmReset(true)}>Apagar configuração desta aba</button> : <div><p>Isso remove apenas os dados de demonstração salvos nesta aba.</p><button className="dangerButton" onClick={reset}>Confirmar exclusão local</button><button className="textButton" onClick={() => setConfirmReset(false)}>Cancelar</button></div>}</section>}
      </div>
    </div>}
  </>;
}
