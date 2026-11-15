import {catalogLimit, type CatalogProduct} from './catalogs';
import {maxPriceCents, type LensType} from './pricing';

export type SpreadsheetCell = string | number | boolean | Date | null;
export type Spreadsheet = SpreadsheetCell[][];
export const importFields = ['code','name','lensType','minimum','maximum','treatments','refractiveIndex','notes'] as const;
export type ImportField = typeof importFields[number];
export type ColumnMapping = Record<ImportField, number>;
export const importLabels: Record<ImportField,string> = {code:'Código / SKU',name:'Nome do produto',lensType:'Tipo de lente',minimum:'Preço de venda / mínimo',maximum:'Preço máximo (opcional)',treatments:'Tratamentos incluídos',refractiveIndex:'Índice de refração',notes:'Observações / restrições'};
export const normalizeCell = (input: unknown) => String(input ?? '').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_-]/g,' ').replace(/\s+/g,' ');
const aliases: Record<ImportField,string[]> = {
  code:['codigo','sku','referencia','cod','code'], name:['produto','nome do produto','lente','descricao','nome','product'],
  lensType:['tipo','tipo de lente','categoria','lens type'], minimum:['preco','preco de venda','valor','valor de venda','venda','preco minimo','minimo','price'],
  maximum:['preco maximo','valor maximo','maximo'], treatments:['tratamentos','tratamentos incluidos','tratamento','coating'],
  refractiveIndex:['indice','indice de refracao','index'], notes:['observacoes','restricoes','notas'],
};
export function suggestColumns(headers: SpreadsheetCell[]): ColumnMapping {
  return Object.fromEntries(importFields.map(field => [field,headers.findIndex(header => aliases[field].includes(normalizeCell(header)))])) as ColumnMapping;
}
export function suggestHeader(grid: Spreadsheet): number {
  const found = grid.slice(0,20).findIndex(row => {const map=suggestColumns(row);return map.name >= 0 && map.minimum >= 0;});
  return found < 0 ? 0 : found;
}
// RFC-style quoted cells, including embedded separators/newlines. No formula execution.
export function parseCsv(input: string): Spreadsheet {
  const source = input.replace(/^\uFEFF/,'');
  if (!source.trim()) throw new Error('O arquivo está vazio.');
  function parse(delimiter: string): Spreadsheet {
    const rows: string[][]=[]; let row:string[]=[]; let cell=''; let quoted=false; let closed=false;
    for (let i=0;i<source.length;i++) {
      const char=source[i];
      if (quoted) {
        if (char==='"') {if(source[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}} else cell+=char;
      } else if(char==='"') {
        if(cell.length || closed)throw new Error('Aspas inválidas no CSV. Exporte novamente a planilha.');
        quoted=true;
      } else if(char===delimiter){row.push(cell);cell='';closed=false;}
      else if(char==='\n'||char==='\r'){
        if(char==='\r'&&source[i+1]==='\n')i++;
        row.push(cell);if(row.some(value=>value.trim()))rows.push(row);row=[];cell='';closed=false;
      } else {if(closed && char.trim())throw new Error('Conteúdo depois de aspas no CSV.');if(!closed)cell+=char;}
      if(rows.length>catalogLimit+25 || row.length>100 || cell.length>2000)throw new Error('A planilha excede o limite de 1.000 produtos, 100 colunas ou 2.000 caracteres por célula.');
    }
    if(quoted)throw new Error('Há aspas não fechadas no CSV.');
    row.push(cell);if(row.some(value=>value.trim()))rows.push(row);
    return rows;
  }
  const candidates = [';',',','\t'].map(separator=>{try{return parse(separator);}catch{return null;}}).filter((rows):rows is Spreadsheet=>Boolean(rows));
  if(!candidates.length)throw new Error('CSV inválido. Confira as aspas e o limite de linhas.');
  candidates.sort((a,b)=>Math.max(...b.slice(0,20).map(row=>row.length))-Math.max(...a.slice(0,20).map(row=>row.length)));
  return candidates[0];
}
// CSV strings accept BR grouping/decimals; XLSX numeric cells use the numeric value.
export function importMoney(value: SpreadsheetCell): number | null {
  if(typeof value==='number'){
    if(!Number.isFinite(value)||value<0||value>maxPriceCents/100)return null;
    const cents=Math.round(value*100);
    return Math.abs(value*100-cents)<0.000001 ? cents : null;
  }
  if(typeof value!=='string')return null;
  let raw=value.trim().replace(/^R\$\s*/i,'');
  if(/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(raw))raw=raw.replace(/\./g,'').replace(',','.');
  else if(!/^\d+\.\d{1,2}$/.test(raw))return null;
  return importMoney(Number(raw));
}
const lensAliases: Record<string,LensType> = {single:'single','visao simples':'single',monofocal:'single',simples:'single',multifocal:'multifocal',progressiva:'multifocal',progressivo:'multifocal',occupational:'occupational',ocupacional:'occupational',office:'occupational'};
export function productsFromGrid(grid: Spreadsheet, header: number, map: ColumnMapping, unit: 'pair' | 'lens', defaultLens?:LensType): {products:CatalogProduct[]; errors:string[]} {
  const errors:string[]=[]; const products:CatalogProduct[]=[]; const codes=new Set<string>();
  if(map.name<0||(map.lensType<0&&!defaultLens)||map.minimum<0)return {products,errors:['Selecione as colunas de produto, tipo de lente e preço de venda. Se não houver coluna de tipo, informe um tipo para a tabela.']};
  const mapped=Object.values(map).filter(index=>index>=0);
  if(new Set(mapped).size!==mapped.length)return {products,errors:['Uma coluna não pode representar dois campos.']};
  for(let i=header+1;i<grid.length;i++){
    const row=grid[i];if(!row.some(cell=>cell!==null&&String(cell).trim()))continue;
    if(row.slice(grid[header].length).some(cell=>cell!==null&&String(cell).trim())){errors.push(`Linha ${i+1}: há mais valores que colunas no cabeçalho. Confira o separador do CSV e coloque valores com vírgula entre aspas.`);continue;}
    const get=(field:ImportField)=>map[field]<0?null:row[map[field]]??null;
    const value=(field:ImportField)=>String(get(field)??'').trim();
    const name=value('name'),code=value('code')||`LINHA-${i+1}`;
    const lensType=map.lensType<0?defaultLens:lensAliases[normalizeCell(get('lensType'))];
    let minimumCents=importMoney(get('minimum'));
    let maximumCents=value('maximum') ? importMoney(get('maximum')) : minimumCents;
    if(unit==='lens'){minimumCents=minimumCents===null?null:minimumCents*2;maximumCents=maximumCents===null?null:maximumCents*2;}
    const treatments=value('treatments'),refractiveIndex=value('refractiveIndex'),notes=value('notes');
    let reason='';
    if(!name||name.length>160||code.length>80||(map.code>=0&&!value('code')))reason='Informe produto (até 160 caracteres) e código (até 80). Se não houver códigos, selecione Não informado para gerar referências por linha.';
    else if(!lensType)reason='Tipo desconhecido. Use visão simples/monofocal, multifocal/progressiva ou ocupacional.';
    else if(minimumCents===null||maximumCents===null||minimumCents<=0||maximumCents<minimumCents||maximumCents>maxPriceCents)reason='Preço inválido, ausente ou máximo menor que mínimo. Informe preço de venda positivo com até duas casas decimais.';
    else if(codes.has(code))reason=`Código duplicado: ${code}.`;
    else if(treatments.length>300||refractiveIndex.length>30||notes.length>500)reason='Tratamentos, índice ou observações ultrapassam o limite de caracteres.';
    if(reason)errors.push(`Linha ${i+1}: ${reason}`);
    else {codes.add(code);products.push({code,name,lensType:lensType!,minimumCents:minimumCents!,maximumCents:maximumCents!,treatments,refractiveIndex,notes});}
  }
  if(!products.length&&!errors.length)errors.push('Nenhum produto encontrado depois do cabeçalho.');
  if(products.length>catalogLimit)errors.push('Importe no máximo 1.000 produtos por tabela.');
  return {products,errors};
}
