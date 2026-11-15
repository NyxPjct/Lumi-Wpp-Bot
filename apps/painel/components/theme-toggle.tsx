'use client';

import {useEffect,useRef,useState} from 'react';

type Theme='light'|'dark';
const storageKey='lumi:theme';
const readChoice=():Theme|null=>{
  try{const value=localStorage.getItem(storageKey);return value==='light'||value==='dark'?value:null;}catch{return null;}
};

export function ThemeToggle(){
  const [theme,setTheme]=useState<Theme>('light');
  const choice=useRef<Theme|null>(null);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: dark)');
    choice.current=readChoice();
    const apply=()=>{
      const next=choice.current??(media.matches?'dark':'light');
      document.documentElement.dataset.theme=next;setTheme(next);
    };
    const sync=(event:StorageEvent)=>{
      if(event.storageArea===localStorage&&(event.key===storageKey||event.key===null)){choice.current=readChoice();apply();}
    };
    apply();media.addEventListener('change',apply);window.addEventListener('storage',sync);
    return ()=>{media.removeEventListener('change',apply);window.removeEventListener('storage',sync);};
  },[]);
  function toggle(){
    const next=theme==='dark'?'light':'dark';
    choice.current=next;document.documentElement.dataset.theme=next;setTheme(next);
    try{localStorage.setItem(storageKey,next);}catch{/* The theme still works when persistence is unavailable. */}
  }
  return <button type="button" className="themeToggle" aria-label="Modo escuro" aria-pressed={theme==='dark'} title={theme==='dark'?'Ativar modo claro':'Ativar modo escuro'} onClick={toggle}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{theme==='dark'?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></>:<path d="M20.5 13a8.5 8.5 0 0 1-9.5-9.5A8.5 8.5 0 1 0 20.5 13Z"/>}</svg><span>{theme==='dark'?'Modo claro':'Modo escuro'}</span>
  </button>;
}
