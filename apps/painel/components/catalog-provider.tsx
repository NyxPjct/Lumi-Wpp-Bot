'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {readCatalog,type PriceCatalog} from '@lumi/shared';
import {useDemoSettings} from './demo-settings';
import {getSupabase} from '../lib/supabase';

const storageKey='lumi:demo:catalogs:v1';
interface CatalogContext {
  tables:PriceCatalog[];ready:boolean;error:string;canEdit:boolean;
  refresh:()=>Promise<PriceCatalog[]>;
  publish:(table:PriceCatalog,expectedRevision:string|null)=>Promise<void>;
}
const Context=createContext<CatalogContext|null>(null);
export function CatalogProvider({children}:{children:ReactNode}){
  const {mode,user,opticId,ready}=useDemoSettings();
  const scope=`${mode}:${user?.id??''}:${opticId??''}`;
  const currentScope=useRef(scope);currentScope.current=scope;
  const generation=useRef(0);
  const [loaded,setLoaded]=useState({scope:'',tables:[] as PriceCatalog[],error:'',canEdit:false});
  async function refresh():Promise<PriceCatalog[]>{
    const request=++generation.current;
    try{
      let tables:PriceCatalog[]=[];let canEdit=mode==='demo';
      if(mode==='demo'){
        const raw=sessionStorage.getItem(storageKey);
        const parsed:unknown=raw?JSON.parse(raw):[];
        if(!Array.isArray(parsed)||parsed.length>30)throw new Error('As tabelas desta demonstração estão inválidas.');
        tables=parsed.map(item=>{const table=readCatalog(item);if(!table)throw new Error('Uma tabela salva está inválida.');return table;});
      }else if(user&&opticId){
        const db=getSupabase();if(!db)throw new Error('Conexão indisponível.');
        const [catalogs,membership]=await Promise.all([
          db.from('price_catalogs').select('*').eq('optic_id',opticId).order('updated_at',{ascending:false}).limit(30),
          db.from('optic_memberships').select('role').eq('optic_id',opticId).eq('user_id',user.id).single(),
        ]);
        if(catalogs.error||membership.error)throw new Error('Não foi possível carregar as tabelas. Confira a conexão e as atualizações do banco.');
        canEdit=membership.data.role==='owner';
        tables=(catalogs.data??[]).map(row=>{
          const table=readCatalog({id:row.id,revision:row.revision,name:row.name,brand:row.brand,validFrom:row.valid_from,validUntil:row.valid_until,updatedAt:row.updated_at,sourceFile:row.source_file,products:row.products});
          if(!table)throw new Error('Uma tabela no banco está inválida.');return table;
        });
      }
      if(currentScope.current!==scope)throw new Error('A conta mudou. Carregue as tabelas novamente.');
      if(request===generation.current)setLoaded({scope,tables,error:'',canEdit});
      return tables;
    }catch(error){
      const message=error instanceof Error?error.message:'Não foi possível carregar as tabelas.';
      if(currentScope.current===scope&&request===generation.current)setLoaded({scope,tables:[],error:message,canEdit:false});
      throw new Error(message);
    }
  }
  useEffect(()=>{
    if(!ready)return;
    void refresh().catch(()=>{});
    const focus=()=>{void refresh().catch(()=>{});};
    window.addEventListener('focus',focus);
    return ()=>{generation.current++;window.removeEventListener('focus',focus);};
  },[ready,scope]);
  async function publish(input:PriceCatalog,expectedRevision:string|null){
    const table=readCatalog(input);
    if(!table||!ready||loaded.scope!==scope||loaded.error||!loaded.canEdit)throw new Error('Carregue as tabelas e entre como proprietário para publicar.');
    if(mode==='demo'){
      const raw=sessionStorage.getItem(storageKey);
      const current:PriceCatalog[]=raw?JSON.parse(raw):[];
      if(!Array.isArray(current)||current.some(item=>!readCatalog(item)))throw new Error('Tabelas de demonstração inválidas.');
      const previous=current.find(item=>item.id===table.id);
      if(previous?.revision!==expectedRevision&&!(previous===undefined&&expectedRevision===null)){
        if(previous?.revision!==table.revision||JSON.stringify(previous)!==JSON.stringify(table))throw new Error('A tabela mudou. Recarregue antes de substituir.');
      }
      const next=[table,...current.filter(item=>item.id!==table.id)];
      if(next.length>30)throw new Error('O limite é de 30 tabelas por ótica.');
      try{sessionStorage.setItem(storageKey,JSON.stringify(next));}catch{throw new Error('Não foi possível salvar nesta aba. Verifique o espaço do navegador.');}
    }else{
      const db=getSupabase();if(!db||!user||!opticId)throw new Error('Configure sua ótica antes de importar tabelas.');
      const {error}=await db.rpc('set_price_catalog',{p_optic_id:opticId,p_catalog_id:table.id,p_expected_revision:expectedRevision,p_revision:table.revision,p_name:table.name,p_brand:table.brand,p_valid_from:table.validFrom,p_valid_until:table.validUntil,p_source_file:table.sourceFile,p_products:table.products});
      if(error)throw new Error(error.code==='40001'?'Esta tabela mudou em outra sessão. Recarregue antes de substituir.':'Não foi possível publicar a tabela. Verifique a conexão e sua permissão de proprietário.');
    }
    if(currentScope.current!==scope)throw new Error('A conta mudou durante a publicação. Recarregue as tabelas.');
    await refresh();
  }
  const current=loaded.scope===scope;
  return <Context.Provider value={{tables:current?loaded.tables:[],ready:ready&&current,error:current?loaded.error:'',canEdit:current&&loaded.canEdit,refresh,publish}}>{children}</Context.Provider>;
}
export function useCatalogs(){const context=useContext(Context);if(!context)throw new Error('CatalogProvider ausente');return context;}
