import {businessDate,catalogStatus,catalogSource,type PriceCatalog} from './catalogs';
import {formatRange,lensLabels,type LensType,type QuoteEstimate} from './pricing';
import {normalizeCell} from './price-import';

export interface CatalogFlow {
  phase:'table'|'product';
  tableId?:string;
  revision?:string;
  page:number;
  search:string;
  options:{id:string;revision:string;code?:string;label:string}[];
}
interface Result {flow?:CatalogFlow;reply:string;estimate?:QuoteEstimate;unavailable?:boolean;valid:boolean}
const pageSize=6;
const activeTables=(tables:PriceCatalog[],lens:LensType,now:string)=>tables.filter(table=>catalogStatus(table,businessDate(new Date(now)))==='active'&&table.products.some(item=>item.lensType===lens));
function list(flow:CatalogFlow,tables:PriceCatalog[],lens:LensType,now:string):Result {
  const active=activeTables(tables,lens,now);
  const table=active.find(item=>item.id===flow.tableId&&item.revision===flow.revision);
  if(flow.phase==='product'&&!table)return {reply:'A tabela foi atualizada ou está fora da validade. Volte ao menu e solicite um novo orçamento.',unavailable:true,valid:true};
  const options=flow.phase==='table'?active.map(item=>({id:item.id,revision:item.revision,label:`${item.brand} · ${item.name}`}))
    :table!.products.filter(item=>item.lensType===lens&&normalizeCell(`${item.name} ${item.code} ${item.treatments} ${item.refractiveIndex}`).includes(flow.search)).map(item=>({id:table!.id,revision:table!.revision,code:item.code,label:`${item.name}${item.refractiveIndex?` · ${item.refractiveIndex}`:''} · ${formatRange(item)}`}));
  if(!options.length)return {reply:flow.phase==='table'?'Não há tabela vigente para esse tipo de lente. Um atendente precisa confirmar o orçamento. A Lumi está pausada.':'Nenhum produto encontrado. Busque outro nome, código ou tratamento; digite menu para voltar.',flow:flow.phase==='product'?{...flow,page:0,options:[]}:undefined,unavailable:flow.phase==='table',valid:true};
  const pages=Math.ceil(options.length/pageSize);const page=Math.max(0,Math.min(flow.page,pages-1));
  const visible=options.slice(page*pageSize,(page+1)*pageSize);
  return {flow:{...flow,page,options:visible},valid:true,reply:[flow.phase==='table'?`Qual tabela deseja consultar para ${lensLabels[lens].toLocaleLowerCase('pt-BR')}?`:'Escolha o produto da tabela. Os valores são pelo par, com os tratamentos descritos já incluídos.',...visible.map((item,index)=>`${index+1}. ${item.label}`),pages>1?`Página ${page+1} de ${pages}. Digite próxima ou anterior para navegar.`:'',flow.phase==='product'?'Você também pode buscar por nome, código ou tratamento. Digite todos para limpar a busca.':'','Digite menu para voltar.'].filter(Boolean).join('\n')};
}
export function startCatalogQuote(tables:PriceCatalog[]|null,lens:LensType,now:string):Result {
  if(!tables)return {valid:true,unavailable:true,reply:'Não foi possível carregar as tabelas da ótica. Um atendente precisa confirmar os preços. A Lumi está pausada.'};
  return list({phase:'table',page:0,search:'',options:[]},tables,lens,now);
}
export function transitionCatalog(flow:CatalogFlow,input:string,tables:PriceCatalog[]|null,lens:LensType,now:string):Result {
  if(!tables)return startCatalogQuote(null,lens,now);
  const normalized=normalizeCell(input);
  if(['proxima','anterior'].includes(normalized))return list({...flow,page:flow.page+(normalized==='proxima'?1:-1)},tables,lens,now);
  if(/^[1-6]$/.test(normalized)&&flow.options[Number(normalized)-1]){
    const option=flow.options[Number(normalized)-1];
    const table=activeTables(tables,lens,now).find(item=>item.id===option.id&&item.revision===option.revision);
    if(!table)return {valid:true,unavailable:true,reply:'A tabela foi atualizada ou está fora da validade. Volte ao menu e solicite um novo orçamento.'};
    if(flow.phase==='table')return list({phase:'product',tableId:table.id,revision:table.revision,page:0,search:'',options:[]},tables,lens,now);
    const product=table.products.find(item=>item.code===option.code&&item.lensType===lens);
    if(!product)return {valid:true,unavailable:true,reply:'Produto indisponível. Um atendente precisa conferir a tabela.'};
    const estimate:QuoteEstimate={lensType:lens,treatments:[],minimumCents:product.minimumCents,maximumCents:product.maximumCents,source:catalogSource(table,product)};
    return {valid:true,estimate,reply:`Estimativa para o par de lentes: ${formatRange(product)}.\n${table.brand} · ${product.name}\nTabela: ${table.name} · Código: ${product.code}${product.refractiveIndex?` · Índice ${product.refractiveIndex}`:''}.\n${product.treatments?`Tratamentos incluídos: ${product.treatments}.`:'A tabela não informa tratamentos incluídos.'}${product.notes?`\nCondições da tabela: ${product.notes}`:''}\nNão inclui armação. O valor final depende de confirmação humana e das condições da tabela. Não interpretamos receitas nesta simulação. A Lumi está pausada.`};
  }
  if(flow.phase==='product'&&normalized&&!/^\d+$/.test(normalized))return list({...flow,search:normalized==='todos'?'':normalized,page:0},tables,lens,now);
  return {flow,reply:'Escolha um dos números exibidos ou digite menu para voltar.',valid:false};
}
