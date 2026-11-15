'use client';
import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {businessDate,validDate,importFields,importLabels,suggestColumns,suggestHeader,productsFromGrid,formatRange,lensLabels,lensTypes,type LensType,type ColumnMapping,type PriceCatalog} from '@lumi/shared';
import {useCatalogs} from './catalog-provider';
import {readPriceFile,type WorkbookSheet} from '../lib/import-file';

export function CatalogImport({existing,onClose,onPublished}:{existing?:PriceCatalog;onClose:()=>void;onPublished:()=>void}){
  const {publish}=useCatalogs();
  const [name,setName]=useState(existing?.name??'');const [brand,setBrand]=useState(existing?.brand??'');
  const [from,setFrom]=useState(existing?.validFrom??businessDate());const [until,setUntil]=useState(existing?.validUntil??'');
  const [sheets,setSheets]=useState<WorkbookSheet[]>([]);const [sheetIndex,setSheetIndex]=useState(0);
  const [header,setHeader]=useState(0);const [mapping,setMapping]=useState<ColumnMapping>(()=>suggestColumns([]));
  const [fileName,setFileName]=useState('');const [unit,setUnit]=useState<'pair'|'lens'>('pair');
  const [defaultLens,setDefaultLens]=useState<LensType|''>('');
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [reading,setReading]=useState(false);const [confirmed,setConfirmed]=useState(false);
  const attempt=useRef<{fingerprint:string;table:PriceCatalog}|null>(null);
  const readingVersion=useRef(0);const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;readingVersion.current++;};},[]);
  const grid=sheets[sheetIndex]?.grid??[];
  const preview=useMemo(()=>grid.length?productsFromGrid(grid,header,mapping,unit,defaultLens||undefined):{products:[],errors:[]},[grid,header,mapping,unit,defaultLens]);
  useEffect(()=>{setConfirmed(false);},[name,brand,from,until,sheets,sheetIndex,header,mapping,unit,defaultLens]);
  function selectSheet(index:number,available=sheets){
    const nextHeader=suggestHeader(available[index]?.grid??[]);
    setSheetIndex(index);setHeader(nextHeader);setMapping(suggestColumns(available[index]?.grid[nextHeader]??[]));
  }
  async function read(file:File){
    const request=++readingVersion.current;
    setError('');setReading(true);setSheets([]);setFileName('');
    try{const result=await readPriceFile(file);if(request!==readingVersion.current)return;setSheets(result);setFileName(file.name);selectSheet(0,result);}
    catch(error){if(request===readingVersion.current)setError(error instanceof Error?error.message:'Não foi possível ler a planilha.');}
    finally{if(request===readingVersion.current)setReading(false);}
  }
  async function submit(event:FormEvent){
    event.preventDefault();if(busy||reading)return;setError('');
    if(!name.trim()||name.trim().length<2||!brand.trim()||brand.trim().length<2){setError('Informe nome da tabela e marca, com pelo menos dois caracteres.');return;}
    if(!validDate(from)||(until&&(!validDate(until)||until<from))){setError('Confira a vigência: a data final deve ser igual ou posterior à inicial.');return;}
    if(!preview.products.length||preview.errors.length||!confirmed){setError('Confira as colunas, corrija todas as linhas e confirme os preços de venda antes de publicar.');return;}
    const fingerprint=JSON.stringify({name:name.trim(),brand:brand.trim(),from,until,products:preview.products,fileName});
    if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,table:{id:existing?.id??crypto.randomUUID(),revision:crypto.randomUUID(),name:name.trim(),brand:brand.trim(),validFrom:from,validUntil:until||null,products:preview.products,sourceFile:fileName,updatedAt:new Date().toISOString()}};
    setBusy(true);
    try{await publish(attempt.current.table,existing?.revision??null);if(mounted.current)onPublished();}
    catch(error){if(mounted.current)setError(error instanceof Error?error.message:'Não foi possível publicar.');}
    finally{if(mounted.current)setBusy(false);}
  }
  return <section className="configCard importPanel" aria-labelledby="import-title">
    <div className="panelTitle"><div><p className="eyebrow">{existing?'ATUALIZAR TABELA':'NOVA TABELA'}</p><h2 id="import-title">{existing?`Substituir ${existing.name}`:'Importar tabela de preços'}</h2><p>Escolha o arquivo, confira as colunas e publique os preços da sua ótica.</p></div><button type="button" className="secondaryButton" disabled={busy||reading} onClick={onClose}>Cancelar importação</button></div>
    <form className="importForm" onSubmit={submit} noValidate><fieldset disabled={busy||reading}>
      <div className="importMeta">
        <div className="field"><label htmlFor="table-name">Nome da tabela</label><input id="table-name" maxLength={100} value={name} onChange={event=>setName(event.target.value)} placeholder="Ex.: Lentes premium · Novembro" required/></div>
        <div className="field"><label htmlFor="table-brand">Marca ou laboratório</label><input id="table-brand" list="lens-brands" maxLength={80} value={brand} onChange={event=>setBrand(event.target.value)} placeholder="Escolha ou digite qualquer marca" required/><datalist id="lens-brands">{['Zeiss','Hoya','Varilux','Lentes próprias'].map(value=><option key={value} value={value}/>)}</datalist></div>
        <div className="field"><label htmlFor="table-from">Válida a partir de</label><input type="date" id="table-from" min="2000-01-01" max="2099-12-31" value={from} onChange={event=>setFrom(event.target.value)} required/></div>
        <div className="field"><label htmlFor="table-until">Válida até (opcional)</label><input type="date" id="table-until" min={from} max="2099-12-31" value={until} onChange={event=>setUntil(event.target.value)}/></div>
      </div>
      <div className="fileDrop"><span className="uploadSymbol" aria-hidden="true">↑</span><label htmlFor="table-file">Selecione sua planilha Excel ou CSV</label><p>.xlsx ou .csv · até 5 MB · 1.000 produtos por tabela</p><input id="table-file" type="file" accept=".xlsx,.csv" onChange={event=>{const file=event.target.files?.[0];if(file)void read(file);}}/><small>Leitura no seu navegador. Uma linha por produto; planilhas em matriz precisam ser organizadas em colunas.</small><a href="/modelo-tabela-lumi.csv" download>Baixar modelo CSV de exemplo</a></div>
      {grid.length>0&&<>
        <div className="importMeta mappingSettings">
          <div className="field"><label htmlFor="sheet-select">Aba da planilha</label><select id="sheet-select" value={sheetIndex} onChange={event=>selectSheet(Number(event.target.value))}>{sheets.map((sheet,index)=><option key={index} value={index}>{sheet.name}</option>)}</select></div>
          <div className="field"><label htmlFor="header-row">Linha do cabeçalho</label><select id="header-row" value={header} onChange={event=>{const index=Number(event.target.value);setHeader(index);setMapping(suggestColumns(grid[index]));}}>{grid.slice(0,20).map((row,index)=><option key={index} value={index}>Linha {index+1} · {row.slice(0,3).join(' / ').slice(0,65)}</option>)}</select></div>
          <div className="field"><label htmlFor="price-unit">Os preços do arquivo são</label><select id="price-unit" value={unit} onChange={event=>setUnit(event.target.value as 'pair'|'lens')}><option value="pair">Pelo par de lentes</option><option value="lens">Por uma lente (multiplicar por 2)</option></select></div>
        </div>
        <h3>Relacione as colunas</h3><p className="mutedCopy">A Lumi sugere os campos pelo cabeçalho. Confira cada seleção; o preço deve ser o valor de venda ao cliente.</p>
        <div className="columnMapping">{importFields.map(field=><div className="field" key={field}><label htmlFor={`map-${field}`}>{importLabels[field]}{['name','lensType','minimum'].includes(field)?' *':''}</label><select id={`map-${field}`} value={mapping[field]} onChange={event=>setMapping(current=>({...current,[field]:Number(event.target.value)}))}><option value={-1}>Não informado</option>{grid[header].map((value,index)=><option key={index} value={index}>{index+1} · {String(value??'(sem título)').slice(0,80)}</option>)}</select></div>)}</div>
        {mapping.lensType<0&&<div className="field"><label htmlFor="default-lens-type">Tipo de lente desta tabela (sem coluna de tipo)</label><select id="default-lens-type" value={defaultLens} onChange={event=>setDefaultLens(event.target.value as LensType|'')}><option value="">Selecione um tipo</option>{lensTypes.map(type=><option key={type} value={type}>{lensLabels[type]}</option>)}</select></div>}
        <p className="note">Sem coluna de código, a Lumi gera uma referência por linha. Preço máximo em branco usa o mesmo valor do preço de venda. Não há soma de adicionais neste catálogo.</p>
        {preview.errors.length>0?<div className="importErrors" role="alert"><strong>Corrija {preview.errors.length} problema(s) antes de publicar.</strong><ul>{preview.errors.slice(0,8).map((message,index)=><li key={index}>{message}</li>)}</ul>{preview.errors.length>8&&<p>Há outros erros no arquivo. Nenhuma linha será publicada até corrigir todos.</p>}</div>:<div className="importSuccess" role="status">{preview.products.length} produtos prontos para conferência. {unit==='lens'?'Os valores abaixo já foram multiplicados por 2.':'Valores mantidos pelo par de lentes.'}</div>}
        <div className="tableScroll" tabIndex={0} aria-label="Prévia dos produtos importados"><table className="productTable"><caption>Prévia · primeiros {Math.min(10,preview.products.length)} de {preview.products.length} produtos válidos</caption><thead><tr><th>Produto / código</th><th>Tipo</th><th>Tratamentos incluídos</th><th>Venda pelo par</th></tr></thead><tbody>{preview.products.slice(0,10).map(item=><tr key={item.code}><td><strong>{item.name}</strong><small>{item.code}{item.refractiveIndex?` · Índice ${item.refractiveIndex}`:''}</small>{item.notes&&<small>{item.notes}</small>}</td><td>{lensLabels[item.lensType]}</td><td>{item.treatments||'Não informado'}</td><td>{formatRange(item)}</td></tr>)}</tbody></table></div>
        <label className="confirmPrices"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/><span>Conferi os produtos, a vigência e os valores de venda pelo par. Os tratamentos descritos já estão incluídos; estes valores podem ser usados nos orçamentos.</span></label>
      </>}
      {error&&<p className="formMessage" role="alert">{error}</p>}
      <div className="formActions"><p>{existing?'A nova versão substitui os produtos desta tabela. Orçamentos salvos preservam os valores anteriores.':'Nenhum preço é publicado antes da sua confirmação.'}</p><button className="primaryButton" disabled={!confirmed||preview.errors.length>0||!preview.products.length}>{busy?'Publicando…':existing?'Publicar atualização':'Publicar tabela'}</button></div>
    </fieldset></form>
    {reading&&<p className="notice" role="status">Lendo a planilha…</p>}
  </section>;
}
